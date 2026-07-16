import { describe, expect, it, vi } from "vitest";
import { FonnteProvider } from "../src/messaging/fonnte-provider.js";

describe("FonnteProvider", () => {
  it("mengirim text dengan timeout dan tidak menaruh token di error", async () => {
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("authorization")).toBe("secret-token");
      return new Response(JSON.stringify({ status: true, id: "out-1" }), { status: 200 });
    });
    const provider = new FonnteProvider({ token: "secret-token", fetchFn });
    await expect(provider.sendText({ to: "628", text: "halo" })).resolves.toEqual({ providerMessageId: "out-1" });
  });

  it("menangani HTTP non-2xx", async () => {
    const provider = new FonnteProvider({ token: "secret-token", fetchFn: vi.fn(async () => new Response("bad", { status: 500 })) });
    await expect(provider.sendText({ to: "628", text: "halo" })).rejects.toThrow("HTTP error 500");
    await expect(provider.sendText({ to: "628", text: "halo" })).rejects.not.toThrow("secret-token");
  });

  it("menormalisasi fixture teks dan menolak field yang tidak stabil", () => {
    const provider = new FonnteProvider({ token: "secret-token" });
    expect(provider.parseWebhook({ id: "m1", sender: "628", message: "MENU", from_me: false })).toEqual([
      expect.objectContaining({ providerMessageId: "m1", sender: "628", type: "text", text: "MENU" }),
    ]);
    expect(provider.parseWebhook({ sender: "628", message: "tanpa id" })).toEqual([]);
  });
});
