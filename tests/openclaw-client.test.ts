import { describe, expect, it, vi } from "vitest";
import { OpenClawClient } from "../src/agent/openclaw-client.js";

const options = {
  gatewayUrl: "http://127.0.0.1:18789",
  gatewayToken: "gateway-secret-value-1234",
  model: "openclaw/default",
};

describe("OpenClawClient", () => {
  it("mengirim session pseudonim dan membaca respons kompatibel OpenAI", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "Jawaban agent" } }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const client = new OpenClawClient({ ...options, fetchFn });
    await expect(client.run({ internalUserId: "panenin:abc", message: "Halo" })).resolves.toEqual({ text: "Jawaban agent" });
    const request = fetchFn.mock.calls[0];
    expect(request?.[0]).toBe("http://127.0.0.1:18789/v1/chat/completions");
    const init = request?.[1];
    expect(JSON.parse(String(init?.body))).toMatchObject({ user: "panenin:abc", model: "openclaw/default", stream: false });
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer gateway-secret-value-1234");
  });

  it("menolak HTTP error dan respons yang tidak valid", async () => {
    const httpClient = new OpenClawClient({ ...options, fetchFn: vi.fn<typeof fetch>().mockResolvedValue(new Response("no", { status: 502 })) });
    await expect(httpClient.run({ internalUserId: "panenin:abc", message: "Halo" })).rejects.toThrow("gateway HTTP 502");
    const invalidClient = new OpenClawClient({ ...options, fetchFn: vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status: 200 })) });
    await expect(invalidClient.run({ internalUserId: "panenin:abc", message: "Halo" })).rejects.toThrow("respons gateway tidak valid");
  });

  it("membatalkan request yang melewati timeout tanpa retry", async () => {
    const fetchFn = vi.fn<typeof fetch>((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    }));
    const client = new OpenClawClient({ ...options, fetchFn, timeoutMs: 5 });
    await expect(client.run({ internalUserId: "panenin:abc", message: "Halo" })).rejects.toThrow("aborted");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
