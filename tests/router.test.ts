import { describe, expect, it, vi } from "vitest";
import { ConversationRouter } from "../src/conversation/router.js";
import { CANCEL_TEXT, EMPTY_QUESTION_TEXT, FALLBACK_TEXT, MENU_TEXT } from "../src/conversation/menu.js";
import type { GeminiGateway } from "../src/ai/gemini-client.js";
import type { Retriever } from "../src/rag/retrieve.js";

function dependencies() {
  const retriever: Retriever = { retrieve: vi.fn(async () => []) };
  const gateway: GeminiGateway = {
    generateText: vi.fn(async () => "jawaban"),
    embedText: vi.fn(async () => [0.1, 0.2]),
  };
  const sessionStore = { resetSession: vi.fn(async () => undefined) };
  return { retriever, gateway, sessionStore };
}

describe("ConversationRouter", () => {
  it("MENU dan HELP menampilkan menu", async () => {
    const deps = dependencies();
    const router = new ConversationRouter(deps);
    expect(await router.route({ sender: "s", text: "MENU" })).toBe(MENU_TEXT);
    expect(await router.route({ sender: "s", text: "help" })).toBe(MENU_TEXT);
  });

  it("TANYA memanggil RAG tepat satu kali", async () => {
    const deps = dependencies();
    const answerFn = vi.fn(async () => ({ answer: "hasil", sources: [] }));
    const router = new ConversationRouter({ ...deps, answerFn });
    await expect(router.route({ sender: "s", text: "TANYA: bagaimana packing?" })).resolves.toBe("hasil");
    expect(answerFn).toHaveBeenCalledOnce();
  });

  it("pertanyaan kosong memberi instruksi", async () => {
    const deps = dependencies();
    const router = new ConversationRouter(deps);
    await expect(router.route({ sender: "s", text: "TANYA:" })).resolves.toBe(EMPTY_QUESTION_TEXT);
  });

  it("pesan tidak dikenal menghasilkan fallback", async () => {
    const deps = dependencies();
    const router = new ConversationRouter(deps);
    await expect(router.route({ sender: "s", text: "buat order" })).resolves.toBe(FALLBACK_TEXT);
  });

  it("BATAL mereset session", async () => {
    const deps = dependencies();
    const router = new ConversationRouter(deps);
    await expect(router.route({ sender: "628", text: "BATAL" })).resolves.toBe(CANCEL_TEXT);
    expect(deps.sessionStore.resetSession).toHaveBeenCalledWith("628");
  });

  it("error Gemini atau Supabase memakai fallback aman", async () => {
    const deps = dependencies();
    const router = new ConversationRouter({
      ...deps,
      answerFn: vi.fn(async () => { throw new Error("SUPABASE_SERVICE_ROLE_KEY=secret"); }),
    });
    const result = await router.route({ sender: "s", text: "TANYA: rahasia" });
    expect(result).not.toContain("secret");
    expect(result).toContain("tidak tersedia");
  });
});
