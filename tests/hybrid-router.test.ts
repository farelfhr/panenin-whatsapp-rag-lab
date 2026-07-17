import { describe, expect, it, vi } from "vitest";
import type { AgentGateway } from "../src/agent/agent-gateway.js";
import { HybridConversationRouter } from "../src/conversation/hybrid-router.js";

describe("HybridConversationRouter", () => {
  it("mempertahankan router deterministik ketika OpenClaw nonaktif", async () => {
    const localRouter = { route: vi.fn().mockResolvedValue("menu lokal") };
    const agentGateway: AgentGateway = { run: vi.fn().mockResolvedValue({ text: "agent" }) };
    const router = new HybridConversationRouter({ localRouter, agentGateway, enabled: false, sessionIdFactory: () => "panenin:test" });
    await expect(router.route({ sender: "6285", text: "halo" })).resolves.toBe("menu lokal");
    expect(agentGateway.run).not.toHaveBeenCalled();
  });

  it("MENU dan BATAL selalu ditangani lokal", async () => {
    const localRouter = { route: vi.fn().mockResolvedValue("lokal") };
    const agentGateway: AgentGateway = { run: vi.fn().mockResolvedValue({ text: "agent" }) };
    const router = new HybridConversationRouter({ localRouter, agentGateway, enabled: true, sessionIdFactory: () => "panenin:test" });
    await expect(router.route({ sender: "6285", text: "MENU" })).resolves.toBe("lokal");
    await expect(router.route({ sender: "6285", text: "BATAL" })).resolves.toBe("lokal");
    expect(agentGateway.run).not.toHaveBeenCalled();
  });

  it("mengirim TANYA ke agent dengan session pseudonim", async () => {
    const localRouter = { route: vi.fn().mockResolvedValue("rag lokal") };
    const run = vi.fn().mockResolvedValue({ text: "jawaban agent" });
    const router = new HybridConversationRouter({ localRouter, agentGateway: { run }, enabled: true, sessionIdFactory: () => "panenin:hashed" });
    await expect(router.route({ sender: "6285", text: "TANYA: cara panen?" })).resolves.toBe("jawaban agent");
    expect(run).toHaveBeenCalledWith({ internalUserId: "panenin:hashed", message: "cara panen?" });
  });

  it("fallback TANYA ke RAG lokal bila gateway gagal", async () => {
    const localRouter = { route: vi.fn().mockResolvedValue("rag lokal") };
    const router = new HybridConversationRouter({
      localRouter,
      agentGateway: { run: vi.fn().mockRejectedValue(new Error("offline")) },
      enabled: true,
      sessionIdFactory: () => "panenin:hashed",
    });
    await expect(router.route({ sender: "6285", text: "TANYA: cara panen?" })).resolves.toBe("rag lokal");
    expect(localRouter.route).toHaveBeenCalledWith({ sender: "6285", text: "TANYA: cara panen?" });
  });

  it("mengembalikan fallback deterministik untuk bahasa natural saat agent gagal", async () => {
    const localRouter = { route: vi.fn().mockResolvedValue("lokal") };
    const router = new HybridConversationRouter({
      localRouter,
      agentGateway: { run: vi.fn().mockRejectedValue(new Error("offline")) },
      enabled: true,
      sessionIdFactory: () => "panenin:hashed",
    });
    const response = await router.route({ sender: "6285", text: "tolong bantu saya" });
    expect(response).toContain("MENU");
    expect(localRouter.route).not.toHaveBeenCalled();
  });

  it("mempertahankan session yang sama untuk percakapan natural multi-turn", async () => {
    const localRouter = { route: vi.fn().mockResolvedValue("lokal") };
    const run = vi.fn().mockResolvedValue({ text: "agent" });
    const router = new HybridConversationRouter({
      localRouter,
      agentGateway: { run },
      enabled: true,
      sessionIdFactory: () => "panenin:conversation-stable",
    });

    await router.route({ sender: "6285", text: "Cabai saya siap minggu depan" });
    await router.route({ sender: "6285", text: "jumlahnya sekitar 200 kilo" });

    expect(run).toHaveBeenNthCalledWith(1, {
      internalUserId: "panenin:conversation-stable",
      message: "Cabai saya siap minggu depan",
    });
    expect(run).toHaveBeenNthCalledWith(2, {
      internalUserId: "panenin:conversation-stable",
      message: "jumlahnya sekitar 200 kilo",
    });
  });
});
