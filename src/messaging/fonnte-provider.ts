import { z } from "zod";
import type { MessagingProvider, NormalizedIncomingMessage } from "../types/messaging.js";
import { normalizeFonntePayload } from "../webhook/normalize-fonnte-payload.js";

const fonnteResponseSchema = z.object({
  status: z.union([z.boolean(), z.string()]).optional(),
  id: z.union([z.string(), z.number()]).optional(),
  detail: z.string().optional(),
}).passthrough();

export interface FonnteProviderOptions {
  token: string;
  endpoint?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export class FonnteProvider implements MessagingProvider {
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  public constructor(private readonly options: FonnteProviderOptions) {
    this.endpoint = options.endpoint ?? "https://api.fonnte.com/send";
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  public async sendText(input: { to: string; text: string }): Promise<{ providerMessageId?: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const form = new FormData();
      form.set("target", input.to);
      form.set("message", input.text);
      const response = await this.fetchFn(this.endpoint, {
        method: "POST",
        headers: { Authorization: this.options.token },
        body: form,
        signal: controller.signal,
      });
      const rawBody: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(`Fonnte HTTP error ${response.status}`);
      }
      const body = fonnteResponseSchema.safeParse(rawBody);
      if (!body.success) throw new Error("Fonnte response tidak valid");
      const providerMessageId = body.data.id === undefined ? undefined : String(body.data.id);
      return providerMessageId ? { providerMessageId } : {};
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Fonnte request timeout");
      }
      throw error instanceof Error ? error : new Error("Fonnte request gagal");
    } finally {
      clearTimeout(timer);
    }
  }

  public parseWebhook(payload: unknown): NormalizedIncomingMessage[] {
    return normalizeFonntePayload(payload);
  }
}
