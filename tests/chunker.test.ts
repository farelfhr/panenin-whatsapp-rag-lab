import { describe, expect, it } from "vitest";
import { chunkText, parseMarkdownDocument } from "../src/rag/chunker.js";

describe("knowledge chunker", () => {
  it("membaca frontmatter sederhana", () => {
    const document = parseMarkdownDocument("---\ntitle: FAQ\ncategory: faq\nversion: 1\nstatus: active\n---\nIsi panduan");
    expect(document.title).toBe("FAQ");
    expect(document.content).toBe("Isi panduan");
  });

  it("menggunakan overlap 30-60 kata untuk dokumen panjang", () => {
    const words = Array.from({ length: 500 }, (_, index) => `kata${index}`).join(" ");
    const chunks = chunkText(words, { targetWords: 200, overlapWords: 40 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.content.split(" ").slice(-40).join(" ")).toBe(chunks[1]?.content.split(" ").slice(0, 40).join(" "));
  });
});
