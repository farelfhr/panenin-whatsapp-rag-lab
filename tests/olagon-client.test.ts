import { describe, expect, it, vi } from "vitest";
import { runOlagonPrompt } from "../src/agent/olagon-client.js";

describe("runOlagonPrompt", () => {
  it("menggunakan header x-api-key dan format Anthropic Messages", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      content: [{ type: "text", text: "OLAGON_OK" }],
    }), { status: 200 }));
    await expect(runOlagonPrompt({
      apiUrl: "https://gateway.olagon.site/anthropic/v1/messages",
      apiKey: "rk_live_test_key_value_123456",
      model: "claude-3-5-sonnet",
      prompt: "Halo",
      fetchFn,
    })).resolves.toBe("OLAGON_OK");
    const init = fetchFn.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).get("x-api-key")).toBe("rk_live_test_key_value_123456");
    expect(new Headers(init?.headers).get("authorization")).toBeNull();
    expect(JSON.parse(String(init?.body))).toMatchObject({ model: "claude-3-5-sonnet", max_tokens: 256 });
  });

  it("menolak HTTP error tanpa mencetak response body", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response("secret response body", { status: 401 }));
    await expect(runOlagonPrompt({
      apiUrl: "https://gateway.olagon.site/anthropic/v1/messages",
      apiKey: "rk_live_test_key_value_123456",
      model: "claude-3-5-sonnet",
      prompt: "Halo",
      fetchFn,
    })).rejects.toThrow("Olagon HTTP 401");
  });
});
