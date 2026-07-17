import { z } from "zod";

const responseSchema = z.object({
  content: z.array(z.union([
    z.object({ type: z.literal("text"), text: z.string() }),
    z.object({ type: z.literal("thinking") }),
  ])).min(1),
});

export interface OlagonPromptOptions {
  apiUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

export async function runOlagonPrompt(options: OlagonPromptOptions): Promise<string> {
  const fetchFn = options.fetchFn ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 60_000);
  try {
    const response = await fetchFn(options.apiUrl, {
      method: "POST",
      headers: {
        "x-api-key": options.apiKey,
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model: options.model, max_tokens: 256, messages: [{ role: "user", content: options.prompt }] }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Olagon HTTP ${response.status}`);
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("respons Olagon tidak valid");
    const text = parsed.data.content
      .filter((item): item is { type: "text"; text: string } => item.type === "text")
      .map((item) => item.text)
      .join("\n")
      .trim();
    if (!text) throw new Error("respons Olagon kosong");
    return text;
  } finally {
    clearTimeout(timer);
  }
}
