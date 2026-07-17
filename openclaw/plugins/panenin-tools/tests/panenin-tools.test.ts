import { describe, expect, it, vi } from "vitest";
import { isAllowedToolUrl, queryPaneninRag } from "../src/index.js";

describe("panenin_rag_query", () => {
  it("hanya mengizinkan endpoint loopback yang ditentukan", () => {
    expect(isAllowedToolUrl("http://127.0.0.1:3001/internal/tools/rag-query")).toBe(true);
    expect(isAllowedToolUrl("https://example.com/internal/tools/rag-query")).toBe(false);
    expect(isAllowedToolUrl("http://127.0.0.1:3001/admin")).toBe(false);
  });

  it("mengirim secret ke service dan hanya mengembalikan jawaban serta sumber", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      answer: "Gunakan panduan panen.",
      sources: [{ title: "SOP", similarity: 0.91 }],
      chunks: [{ content: "tidak boleh keluar" }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const result = await queryPaneninRag({
      question: "Bagaimana panen cabai?",
      toolUrl: "http://127.0.0.1:3001/internal/tools/rag-query",
      toolSecret: "x".repeat(24),
      fetchFn,
    });
    expect(result).toEqual({ answer: "Gunakan panduan panen.", sources: [{ title: "SOP", similarity: 0.91 }] });
    expect(JSON.stringify(result)).not.toContain("chunks");
  });
});
