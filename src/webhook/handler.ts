import type { MessagingProvider, NormalizedIncomingMessage } from "../types/messaging.js";
import { sanitizePayload } from "./sanitize.js";
import type { WebhookStore } from "../database/supabase.js";
export interface ConversationRouterLike {
  route(input: { sender: string; text: string }): Promise<string>;
}

export interface WebhookHandlerDependencies {
  provider: MessagingProvider;
  store: WebhookStore;
  router: ConversationRouterLike;
  webhookSecret?: string;
  schedule?: (task: () => Promise<void>) => void;
  logInfo?: (message: string) => void;
  logError?: (message: string) => void;
}

export function createWebhookHandler(dependencies: WebhookHandlerDependencies) {
  const schedule = dependencies.schedule ?? ((task) => queueMicrotask(() => void task()));
  return async function handle(request: Request): Promise<Response> {
    if (request.method.toUpperCase() !== "POST") return new Response("method not allowed", { status: 405 });
    const suppliedSecret = request.headers.get("x-webhook-secret")
      ?? new URL(request.url).searchParams.get("token");
    if (dependencies.webhookSecret && suppliedSecret !== dependencies.webhookSecret) {
      dependencies.logError?.("Webhook Fonnte ditolak: secret tidak valid atau header tidak tersedia");
      return new Response("unauthorized", { status: 401 });
    }

    const payload = await parseRequestPayload(request);
    const messages = dependencies.provider.parseWebhook(payload);
    if (messages.length === 0) {
      dependencies.logError?.("Webhook Fonnte diterima tetapi payload tidak memiliki ID/sender yang dikenali");
    }
    const accepted: NormalizedIncomingMessage[] = [];
    for (const message of messages) {
      if (!message.providerMessageId || !message.sender) continue;
      let claimed: boolean;
      try {
        claimed = await dependencies.store.claimIncoming(message, sanitizePayload(message.raw));
      } catch {
        dependencies.logError?.("Webhook Fonnte gagal disimpan; provider diminta mencoba ulang");
        return new Response("temporarily unavailable", { status: 503 });
      }
      if (claimed) accepted.push(message);
    }
    if (accepted.length > 0) {
      dependencies.logInfo?.(`Webhook Fonnte menerima ${accepted.length} pesan baru`);
    }

    schedule(async () => {
      for (const message of accepted) {
        if (message.type !== "text" || !message.text) {
          await markStatus(dependencies, message.providerMessageId, "processed");
          continue;
        }
        let reply: string;
        try {
          reply = await dependencies.router.route({ sender: message.sender, text: message.text });
        } catch {
          dependencies.logError?.("Pembuatan balasan AI gagal; pesan WhatsApp tidak dikirim");
          await markStatus(dependencies, message.providerMessageId, "failed");
          continue;
        }
        try {
          await dependencies.provider.sendText({ to: message.sender, text: reply });
          await markStatus(dependencies, message.providerMessageId, "processed");
          dependencies.logInfo?.("Balasan WhatsApp berhasil dikirim melalui Fonnte");
        } catch (error) {
          await markStatus(dependencies, message.providerMessageId, "failed");
          dependencies.logError?.(safeSendFailure(error));
        }
      }
    });
    return new Response(JSON.stringify({ status: "ok", accepted: accepted.length }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}

async function markStatus(
  dependencies: WebhookHandlerDependencies,
  providerMessageId: string,
  status: "processed" | "failed",
): Promise<void> {
  try {
    await dependencies.store.markIncomingStatus(providerMessageId, status);
  } catch {
    dependencies.logError?.("Status pemrosesan webhook gagal diperbarui");
  }
}

function safeSendFailure(error: unknown): string {
  if (!(error instanceof Error)) return "Pengiriman balasan melalui Fonnte gagal";
  const safeMessages = [
    "Fonnte menolak token device",
    "Device Fonnte tidak terhubung",
    "Fonnte menolak nomor tujuan",
    "Kuota Fonnte tidak mencukupi",
    "Fonnte menolak pengiriman pesan",
    "Fonnte request timeout",
  ];
  if (safeMessages.includes(error.message)) return error.message;
  if (/^Fonnte HTTP error \d{3}$/.test(error.message)) return error.message;
  return "Pengiriman balasan melalui Fonnte gagal";
}

async function parseRequestPayload(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("application/json") || contentType === "") {
    try {
      return await request.json();
    } catch {
      return {};
    }
  }
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    try {
      const form = await request.formData();
      return Object.fromEntries(Array.from(form.entries()).map(([key, value]) => [key, typeof value === "string" ? value : value.name]));
    } catch {
      return {};
    }
  }
  try {
    return await request.json();
  } catch {
    return {};
  }
}
