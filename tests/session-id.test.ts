import { describe, expect, it } from "vitest";
import { createAgentSessionId } from "../src/agent/session-id.js";

describe("createAgentSessionId", () => {
  it("stabil, berbeda per nomor, dan tidak membocorkan nomor", () => {
    const secret = "session-hmac-secret-value-123";
    const phone = "6285226158143";
    const first = createAgentSessionId(phone, secret);
    expect(first).toBe(createAgentSessionId(phone, secret));
    expect(first).not.toBe(createAgentSessionId("628111111111", secret));
    expect(first).not.toContain(phone);
    expect(first).toMatch(/^panenin:[a-f0-9]{24}$/);
  });

  it("menolak sender kosong dan secret pendek", () => {
    expect(() => createAgentSessionId("", "x".repeat(24))).toThrow();
    expect(() => createAgentSessionId("6285", "pendek")).toThrow();
  });
});
