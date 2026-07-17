import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const config = readFileSync(
  resolve("openclaw", "config", "openclaw.example.json5"),
  "utf8",
);
const launcher = readFileSync(
  resolve("scripts", "start-openclaw.ts"),
  "utf8",
);

describe("OpenClaw Groq config", () => {
  it("memakai Groq OpenAI-compatible sebagai model utama", () => {
    expect(config).toContain('primary: "${OPENCLAW_PRIMARY_MODEL}"');
    expect(config).toContain('"${OPENCLAW_FALLBACK_MODEL}"');
    expect(config).toContain('"${OPENCLAW_TERTIARY_MODEL}"');
    expect(config).toContain('baseUrl: "${GROQ_BASE_URL}"');
    expect(config).toContain('apiKey: "${GROQ_API_KEY}"');
    expect(config).toContain('"groq-fast":');
    expect(config).toContain('"groq-backup":');
    expect(config).toContain('id: "${GROQ_FALLBACK_MODEL}"');
    expect(config).toContain('id: "${GROQ_TERTIARY_MODEL}"');
    expect(config).toContain("rateLimitedProfileRotations: 0");
    expect(config).toContain("overloadedProfileRotations: 0");
    expect(launcher).toContain('OPENCLAW_SDK_RETRY_MAX_WAIT_SECONDS: "5"');
    expect(config).toContain('api: "openai-completions"');
    expect(config).not.toContain("ANTHROPIC_API_KEY");
    expect(config).not.toContain("gateway.olagon");
  });

  it("mempertahankan loopback dan satu tool read-only", () => {
    expect(config).toContain('bind: "loopback"');
    expect(config).toContain('allow: ["panenin_rag_query"]');
  });

  it("membatasi konteks ke skill Panenin dan mode lean", () => {
    expect(config).toContain('"conversation-companion"');
    expect(config).toContain('"harvest-intake"');
    expect(config).toContain('"knowledge-rag"');
    expect(config).toContain('"sales-planner"');
    expect(config).toContain('contextInjection: "continuation-skip"');
    expect(config).toContain("localModelLean: true");
    expect(config).toContain("maxSkillsPromptChars: 1800");
    expect(config).toContain("toolSearch: false");
    expect(config).toContain('reasoning_effort: "low"');
    expect(config).toContain('reasoning_effort: "none"');
    expect(config).toContain('reasoning_format: "hidden"');
  });
});
