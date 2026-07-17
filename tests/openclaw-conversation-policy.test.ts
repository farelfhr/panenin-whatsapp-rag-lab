import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readWorkspace(...segments: string[]): string {
  return readFileSync(resolve("openclaw", "workspace", ...segments), "utf8");
}

describe("OpenClaw conversation policy", () => {
  it("mendefinisikan orkestrasi analisis tanpa membuka chain-of-thought", () => {
    const agents = readWorkspace("AGENTS.md");
    const companion = readWorkspace("skills", "conversation-companion", "SKILL.md");

    expect(agents).toContain("Orkestrasi diam-diam");
    expect(agents).toContain("Jangan memperlihatkan chain-of-thought");
    expect(agents).toContain("Prioritaskan 1-3 hal");
    expect(agents).toContain("jangan memakainya hanya karena pengguna menyebut komoditas");
    expect(agents).toContain("jangan langsung membuat SOP");
    expect(agents).toContain("Default maksimal sekitar 120 kata");
    expect(companion).toContain("kesimpulan lalu 1-3 alasan/prioritas");
    expect(companion.toLowerCase()).toContain("tanpa memaksa command atau formulir");
  });

  it("tidak mengubah setiap percakapan menjadi formulir draft", () => {
    const harvest = readWorkspace("skills", "harvest-intake", "SKILL.md");
    const sales = readWorkspace("skills", "sales-planner", "SKILL.md");

    expect(harvest).toContain("Jangan menanyakan semua sekaligus");
    expect(harvest).toContain("hanya ketika pengguna meminta ringkasan");
    expect(sales).toContain("bukan pada setiap balasan");
  });

  it("tetap membatasi seluruh tindakan ke draft/read-only", () => {
    const agents = readWorkspace("AGENTS.md");
    const companion = readWorkspace("skills", "conversation-companion", "SKILL.md");

    expect(agents).toContain("Jangan membuat atau mengubah transaksi");
    expect(companion).toContain("tidak dieksekusi");
  });
});
