import { describe, expect, it, vi } from "vitest";
import type { TextGenerationGateway } from "../src/ai/gateway.js";
import type { Retriever } from "../src/rag/retrieve.js";
import { createRagQueryHandler } from "../src/internal-tools/rag-query-handler.js";

const toolSecret = "internal-tool-secret-123456";
const retriever: Retriever = { retrieve: vi.fn().mockResolvedValue([]) };
const gateway: TextGenerationGateway = {
  generateText: vi.fn().mockResolvedValue(""),
};

function request(body: unknown, secret = toolSecret): Request {
  return new Request("http://127.0.0.1:3001/internal/tools/rag-query", {
    method: "POST",
    headers: { "content-type": "application/json", "x-panenin-tool-secret": secret },
    body: JSON.stringify(body),
  });
}

describe("internal RAG tool", () => {
  it("menolak secret salah sebelum menjalankan RAG", async () => {
    const answerFn = vi.fn().mockResolvedValue({ answer: "x", sources: [] });
    const handler = createRagQueryHandler({ toolSecret, retriever, gateway, answerFn });
    const response = await handler(request({ question: "cara panen" }, "salah"));
    expect(response.status).toBe(401);
    expect(answerFn).not.toHaveBeenCalled();
  });

  it("memvalidasi pertanyaan", async () => {
    const handler = createRagQueryHandler({ toolSecret, retriever, gateway });
    expect((await handler(request({ question: "x" }))).status).toBe(400);
    expect((await handler(request({ question: "x".repeat(1_001) }))).status).toBe(400);
    expect((await handler(request({ category: "panen" }))).status).toBe(400);
  });

  it("hanya mengembalikan jawaban dan maksimal empat sumber", async () => {
    const answerFn = vi.fn().mockResolvedValue({
      answer: "Panduan singkat",
      sources: Array.from({ length: 6 }, (_, index) => ({ title: `S${index}`, similarity: 0.9 })),
      chunks: ["rahasia"],
    });
    const handler = createRagQueryHandler({ toolSecret, retriever, gateway, answerFn });
    const response = await handler(request({ question: "Bagaimana cara panen?", category: "panen" }));
    const body = await response.json() as Record<string, unknown>;
    expect(response.status).toBe(200);
    expect(body["answer"]).toBe("Panduan singkat");
    expect(body["sources"]).toHaveLength(4);
    expect(body).not.toHaveProperty("chunks");
  });

  it("mengembalikan error aman saat pipeline gagal", async () => {
    const handler = createRagQueryHandler({ toolSecret, retriever, gateway, answerFn: vi.fn().mockRejectedValue(new Error("database detail")) });
    const response = await handler(request({ question: "Bagaimana cara panen?" }));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("database detail");
  });
});
