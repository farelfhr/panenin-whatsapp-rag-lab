import { describe, expect, it } from "vitest";
import {
  parseAgentEnv,
  parseGroqEnv,
} from "../src/config/env.js";

const fakeGroqKey = "test-key-not-a-real-secret-123";

describe("Groq environment", () => {
  it("menggunakan endpoint resmi dan model default", () => {
    expect(parseGroqEnv({ GROQ_API_KEY: fakeGroqKey })).toMatchObject({
      GROQ_BASE_URL: "https://api.groq.com/openai/v1",
      GROQ_MODEL: "openai/gpt-oss-120b",
      GROQ_FALLBACK_MODEL: "openai/gpt-oss-20b",
      GROQ_TERTIARY_MODEL: "qwen/qwen3.6-27b",
    });
  });

  it("menolak base URL non-HTTPS", () => {
    expect(() => parseGroqEnv({
      GROQ_API_KEY: fakeGroqKey,
      GROQ_BASE_URL: "http://api.groq.com/openai/v1",
    })).toThrow("GROQ_BASE_URL");
  });

  it("mengaktifkan OpenClaw dengan Groq tanpa credential provider lama", () => {
    expect(parseAgentEnv({
      OPENCLAW_ENABLED: "true",
      OPENCLAW_GATEWAY_TOKEN: "gateway-token-at-least-24-chars",
      OPENCLAW_MODEL: "openclaw/default",
      AGENT_SESSION_HMAC_SECRET: "session-secret-at-least-24-chars",
      PANENIN_TOOL_SECRET: "internal-secret-at-least-24-chars",
      GROQ_API_KEY: fakeGroqKey,
    })).toMatchObject({
      OPENCLAW_ENABLED: true,
      GROQ_MODEL: "openai/gpt-oss-120b",
      GROQ_FALLBACK_MODEL: "openai/gpt-oss-20b",
      GROQ_TERTIARY_MODEL: "qwen/qwen3.6-27b",
    });
  });
});
