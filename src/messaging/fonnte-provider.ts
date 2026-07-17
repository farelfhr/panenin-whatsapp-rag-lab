import { z } from "zod";
import type { MessagingProvider, NormalizedIncomingMessage } from "../types/messaging.js";
import { normalizeFonntePayload } from "../webhook/normalize-fonnte-payload.js";

const fonnteResponseSchema = z.object({
  status: z.union([z.boolean(), z.string()]).optional(),
  id: z.union([
    z.string(),
    z.number(),
    z.array(z.union([z.string(), z.number()])),
  ]).optional(),
  detail: z.string().optional(),
  reason: z.string().optional(),
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
      if (isRejectedStatus(body.data.status)) {
        throw new Error(describeFonnteRejection(body.data.reason ?? body.data.detail));
      }
      const rawProviderMessageId = body.data.id;
      const providerMessageIdValue = Array.isArray(rawProviderMessageId)
        ? rawProviderMessageId[0]
        : rawProviderMessageId;
      const providerMessageId = providerMessageIdValue === undefined
        ? undefined
        : String(providerMessageIdValue);
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

function isRejectedStatus(status: boolean | string | undefined): boolean {
  return status === false || (typeof status === "string" && status.toLowerCase() === "false");
}

function describeFonnteRejection(reason: string | undefined): string {
  const normalized = reason?.trim().toLowerCase() ?? "";
  if (normalized.includes("token") || normalized.includes("device not found") || normalized.includes("unknown user")) {
    return "Fonnte menolak token device";
  }
  if (normalized.includes("disconnect")) return "Device Fonnte tidak terhubung";
  if (normalized.includes("target")) return "Fonnte menolak nomor tujuan";
  if (normalized.includes("quota") || normalized.includes("balance")) {
    return "Kuota Fonnte tidak mencukupi";
  }
  return "Fonnte menolak pengiriman pesan";
}
