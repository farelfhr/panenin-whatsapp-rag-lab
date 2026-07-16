import { GoogleGenAI, Type } from "@google/genai";

export interface StructuredSchema {
  type: Type;
  properties: Record<string, unknown>;
  required: string[];
}

export interface GeminiGateway {
  generateText(input: {
    prompt: string;
    systemInstruction?: string;
    responseSchema?: StructuredSchema;
  }): Promise<string>;
  embedText(input: { text: string; outputDimensionality: number }): Promise<number[]>;
}

export interface GeminiClientOptions {
  apiKey: string;
  chatModel: string;
  embeddingModel: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
}

export class GeminiClient implements GeminiGateway {
  private readonly ai: GoogleGenAI;
  private readonly chatModel: string;
  private readonly embeddingModel: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  public constructor(options: GeminiClientOptions) {
    this.ai = new GoogleGenAI({ apiKey: options.apiKey, ...(options.fetch ? { fetch: options.fetch } : {}) });
    this.chatModel = options.chatModel;
    this.embeddingModel = options.embeddingModel;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxRetries = options.maxRetries ?? 2;
  }

  public async generateText(input: {
    prompt: string;
    systemInstruction?: string;
    responseSchema?: StructuredSchema;
  }): Promise<string> {
    return runWithRetry(
      async () => {
        const response = await this.ai.models.generateContent({
          model: this.chatModel,
          contents: input.prompt,
          config: {
            ...(input.systemInstruction ? { systemInstruction: input.systemInstruction } : {}),
            ...(input.responseSchema
              ? {
                  responseMimeType: "application/json",
                  responseSchema: input.responseSchema,
                }
              : {}),
          },
        });
        return response.text?.trim() ?? "";
      },
      this.timeoutMs,
      this.maxRetries,
    );
  }

  public async embedText(input: { text: string; outputDimensionality: number }): Promise<number[]> {
    const result = await runWithRetry(
      () => this.ai.models.embedContent({
        model: this.embeddingModel,
        contents: input.text,
        config: { outputDimensionality: input.outputDimensionality },
      }),
      this.timeoutMs,
      this.maxRetries,
    );
    const values = result.embeddings?.[0]?.values;
    if (!values) {
      throw new Error("Embedding kosong dari Gemini");
    }
    return values;
  }
}

async function runWithRetry<T>(operation: () => Promise<T>, timeoutMs: number, maxRetries: number): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await withTimeout(operation(), timeoutMs);
    } catch (error) {
      if (attempt >= maxRetries || !isRetryable(error)) throw error;
      await new Promise<void>((resolve) => setTimeout(resolve, 100 * (2 ** attempt)));
    }
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Gemini request timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isRetryable(error: unknown): boolean {
  if (!(error instanceof Error)) return true;
  return /(?:429|500|502|503|504|timeout|timed out|network|ECONNRESET|fetch failed)/i.test(error.message);
}
