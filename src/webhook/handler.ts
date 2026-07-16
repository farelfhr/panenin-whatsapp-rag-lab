import type { MessagingProvider, NormalizedIncomingMessage } from "../types/messaging.js";
import { sanitizePayload } from "./sanitize.js";
import type { WebhookStore } from "../database/supabase.js";
import type { ConversationRouter } from "../conversation/router.js";

export interface WebhookHandlerDependencies {
  provider: MessagingProvider;
  store: WebhookStore;
  router: ConversationRouter;
  webhookSecret?: string;
  schedule?: (task: () => Promise<void>) => void;
  logError?: (message: string) => void;
}

export function createWebhookHandler(dependencies: WebhookHandlerDependencies) {
  const schedule = dependencies.schedule ?? ((task) => queueMicrotask(() => void task()));
  return async function handle(request: Request): Promise<Response> {
    if (request.method.toUpperCase() !== "POST") return new Response("method not allowed", { status: 405 });
    if (dependencies.webhookSecret && request.headers.get("x-webhook-secret") !== dependencies.webhookSecret) {
      return new Response("unauthorized", { status: 401 });
    }

    const payload = await parseRequestPayload(request);
    const messages = dependencies.provider.parseWebhook(payload);
    const accepted: NormalizedIncomingMessage[] = [];
    for (const message of messages) {
      if (!message.providerMessageId || !message.sender) continue;
      const claimed = await dependencies.store.claimIncoming(message, sanitizePayload(message.raw));
      if (claimed) accepted.push(message);
    }

    schedule(async () => {
      for (const message of accepted) {
        if (message.type !== "text" || !message.text) continue;
        try {
          const reply = await dependencies.router.route({ sender: message.sender, text: message.text });
          await dependencies.provider.sendText({ to: message.sender, text: reply });
        } catch {
          dependencies.logError?.("Pemrosesan webhook gagal");
        }
      }
    });
    return new Response(JSON.stringify({ status: "ok", accepted: accepted.length }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
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
