import { z } from "zod";
import type {
  StructuredSchema,
  TextGenerationGateway,
} from "./gateway.js";

const groqResponseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({
      content: z.string(),
    }),
  })).min(1),
});

export interface GroqClientOptions {
  apiKey: string;
  model: string;
  fallbackModels?: string[];
  baseUrl?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
  maxCompletionTokens?: number;
}

export class GroqClient implements TextGenerationGateway {
  private readonly apiKey: string;
  private readonly models: string[];
  private readonly baseUrl: string;
  private readonly fetch: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly maxCompletionTokens: number;

  public constructor(options: GroqClientOptions) {
    this.apiKey = options.apiKey;
    this.models = [...new Set([
      options.model,
      ...(options.fallbackModels ?? []),
    ].map((model) => model.trim()).filter(Boolean))];
    this.baseUrl = options.baseUrl?.replace(/\/+$/, "")
      ?? "https://api.groq.com/openai/v1";
    this.fetch = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.maxRetries = options.maxRetries ?? 2;
    this.maxCompletionTokens = options.maxCompletionTokens ?? 1_200;
  }

  public async generateText(input: {
    prompt: string;
    systemInstruction?: string;
    responseSchema?: StructuredSchema;
  }): Promise<string> {
    let lastError: unknown = new Error("Model Groq tidak tersedia");
    for (const model of this.models) {
      for (let attempt = 0; ; attempt += 1) {
        try {
          return await this.request(input, model);
        } catch (error) {
          lastError = error;
          if (!isRetryable(error)) throw error;
          if (attempt >= this.maxRetries) break;
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 100 * (2 ** attempt));
          });
        }
      }
    }
    throw lastError;
  }

  private async request(input: {
    prompt: string;
    systemInstruction?: string;
    responseSchema?: StructuredSchema;
  }, model: string): Promise<string> {
    const messages = [
      ...(input.systemInstruction
        ? [{ role: "system" as const, content: input.systemInstruction }]
        : []),
      { role: "user" as const, content: input.prompt },
    ];
    const response = await withTimeout(
      (signal) => this.fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          max_completion_tokens: this.maxCompletionTokens,
          temperature: input.responseSchema ? 0 : 0.25,
          ...(input.responseSchema
            ? { response_format: { type: "json_object" } }
            : {}),
        }),
        signal,
      }),
      this.timeoutMs,
    );

    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new GroqHttpError(response.status);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error("Respons Groq bukan JSON valid");
    }
    const parsed = groqResponseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error("Format respons Groq tidak valid");
    }
    return parsed.data.choices[0]?.message.content.trim() ?? "";
  }
}

class GroqHttpError extends Error {
  public constructor(public readonly status: number) {
    super(`Groq HTTP ${status}`);
    this.name = "GroqHttpError";
  }
}

async function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("Groq request timeout"));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isRetryable(error: unknown): boolean {
  if (error instanceof GroqHttpError) {
    return error.status === 429 || error.status >= 500;
  }
  return error instanceof Error
    && /(?:timeout|timed out|network|ECONNRESET|fetch failed|abort)/i.test(error.message);
}
