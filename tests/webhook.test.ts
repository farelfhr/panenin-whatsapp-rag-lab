import { describe, expect, it, vi } from "vitest";
import { FonnteProvider } from "../src/messaging/fonnte-provider.js";
import { createWebhookHandler } from "../src/webhook/handler.js";
import type { ConversationRouter } from "../src/conversation/router.js";
import type { WebhookStore } from "../src/database/supabase.js";

function setup() {
  const provider = new FonnteProvider({ token: "do-not-log", fetchFn: vi.fn(async () => new Response(JSON.stringify({ status: true }), { status: 200 })) });
  const claimedIds = new Set<string>();
  const store: WebhookStore = {
    claimIncoming: vi.fn(async (message) => {
      if (claimedIds.has(message.providerMessageId)) return false;
      claimedIds.add(message.providerMessageId);
      return true;
    }),
    resetSession: vi.fn(async () => undefined),
  };
  const router = { route: vi.fn(async () => "reply") } as unknown as ConversationRouter;
  const tasks: Array<() => Promise<void>> = [];
  const handler = createWebhookHandler({ provider, store, router, schedule: (task) => tasks.push(task) });
  return { provider, store, router, tasks, handler };
}

describe("webhook", () => {
  it("mencatat penolakan secret tanpa membocorkan nilainya", async () => {
    const setupResult = setup();
    const logError = vi.fn();
    const handler = createWebhookHandler({
      provider: setupResult.provider,
      store: setupResult.store,
      router: setupResult.router,
      webhookSecret: "expected-secret",
      logError,
    });

    const response = await handler(new Request("http://localhost/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }));

    expect(response.status).toBe(401);
    expect(logError).toHaveBeenCalledWith(expect.stringContaining("secret tidak valid"));
    expect(logError).not.toHaveBeenCalledWith(expect.stringContaining("expected-secret"));
  });

  it("menerima secret melalui query token untuk kompatibilitas Fonnte", async () => {
    const setupResult = setup();
    const handler = createWebhookHandler({
      provider: setupResult.provider,
      store: setupResult.store,
      router: setupResult.router,
      webhookSecret: "expected-secret",
    });

    const response = await handler(new Request("http://localhost/webhook?token=expected-secret", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "msg-query-token", sender: "6281234567890", message: "MENU" }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", accepted: 1 });
  });

  it("menerima JSON, deduplicate, ack cepat, lalu proses", async () => {
    const setupResult = setup();
    const request = new Request("http://localhost/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "msg-demo-001", sender: "6281234567890", message: "MENU", from_me: false }),
    });
    const response = await setupResult.handler(request);
    expect(response.status).toBe(200);
    expect(setupResult.tasks).toHaveLength(1);
    expect(setupResult.router.route).not.toHaveBeenCalled();
    await setupResult.tasks[0]?.();
    expect(setupResult.router.route).toHaveBeenCalledOnce();
    expect(setupResult.provider).toBeDefined();
  });

  it("duplicate message tidak diproses dua kali", async () => {
    const setupResult = setup();
    const body = JSON.stringify({ id: "msg-demo-001", sender: "6281234567890", message: "MENU", from_me: false });
    await setupResult.handler(new Request("http://localhost/webhook", { method: "POST", headers: { "content-type": "application/json" }, body }));
    await setupResult.handler(new Request("http://localhost/webhook", { method: "POST", headers: { "content-type": "application/json" }, body }));
    expect(setupResult.store.claimIncoming).toHaveBeenCalledTimes(2);
    expect(setupResult.tasks).toHaveLength(2);
    await setupResult.tasks[0]?.();
    await setupResult.tasks[1]?.();
    expect(setupResult.router.route).toHaveBeenCalledOnce();
  });

  it("outgoing event bot sendiri diabaikan", async () => {
    const setupResult = setup();
    const response = await setupResult.handler(new Request("http://localhost/webhook", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "bot-1", sender: "628", message: "reply", from_me: true }),
    }));
    expect(response.status).toBe(200);
    expect(setupResult.store.claimIncoming).not.toHaveBeenCalled();
  });
});
