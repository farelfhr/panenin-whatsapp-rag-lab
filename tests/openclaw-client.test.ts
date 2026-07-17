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
    expect(JSON.parse(String(init?.body))).toMatchObject({
      user: "panenin:abc",
      model: "openclaw/default",
      stream: false,
      max_completion_tokens: 384,
      temperature: 0.4,
    });
    expect(String((JSON.parse(String(init?.body)) as {
      messages: Array<{ content: string }>;
    }).messages[0]?.content)).toContain("PESAN PENGGUNA:\nHalo");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer gateway-secret-value-1234");
  });

  it("mengirim aturan ringkas pada giliran lanjutan", async () => {
    const fetchFn = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: "Jawaban pertama" } }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: "Jawaban kedua" } }],
      }), { status: 200 }));
    const client = new OpenClawClient({ ...options, fetchFn });

    await client.run({ internalUserId: "panenin:abc", message: "Halo" });
    await client.run({ internalUserId: "panenin:abc", message: "Lanjut" });

    const body = JSON.parse(String(fetchFn.mock.calls[1]?.[1]?.body)) as {
      messages: Array<{ content: string }>;
    };
    expect(body.messages[0]?.content).toContain("analisis maksimal 3 prioritas");
    expect(body.messages[0]?.content).toContain("PESAN PENGGUNA:\nLanjut");
    expect(body.messages[0]?.content).not.toContain("INSTRUKSI APLIKASI PANENIN");
  });

  it("tidak meneruskan istilah arsitektur internal ke pengguna", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      choices: [{
        message: {
          content: "OpenClaw memakai panenin_rag_query dan similarity dari RAG.",
        },
      }],
    }), { status: 200 }));
    const client = new OpenClawClient({ ...options, fetchFn });

    const result = await client.run({ internalUserId: "panenin:safe", message: "Kamu pakai apa?" });

    expect(result.text).not.toMatch(/openclaw|panenin_rag_query|similarity|\bRAG\b/i);
    expect(result.text).toContain("basis pengetahuan Panenin");
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

  it("beralih ke model fallback pada rate limit dengan session yang sama", async () => {
    const fetchFn = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: "Jawaban model cepat" } }],
      }), { status: 200 }));
    const client = new OpenClawClient({
      ...options,
      fallbackModel: "groq-fast/llama-3.1-8b-instant",
      maxRateLimitRetries: 0,
      fetchFn,
    });

    await expect(client.run({
      internalUserId: "panenin:abc",
      message: "Halo",
    })).resolves.toEqual({ text: "Jawaban model cepat" });

    const firstBody = JSON.parse(String(fetchFn.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    const fallbackBody = JSON.parse(String(fetchFn.mock.calls[1]?.[1]?.body)) as Record<string, unknown>;
    expect(firstBody).toMatchObject({
      model: "openclaw/default",
      user: "panenin:abc",
    });
    expect(fallbackBody).toMatchObject({
      model: "openclaw/default",
      user: "panenin:abc",
    });
    expect(fallbackBody["messages"]).toEqual(firstBody["messages"]);
    expect(new Headers(fetchFn.mock.calls[1]?.[1]?.headers).get("x-openclaw-model"))
      .toBe("groq-fast/llama-3.1-8b-instant");
  });

  it("menunggu singkat lalu mengulang request read-only pada 429", async () => {
    const fetchFn = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: "Pulih setelah cooldown" } }],
      }), { status: 200 }));
    const client = new OpenClawClient({
      ...options,
      fetchFn,
      rateLimitRetryDelayMs: 0,
    });

    await expect(client.run({
      internalUserId: "panenin:retry",
      message: "Halo",
    })).resolves.toEqual({ text: "Pulih setelah cooldown" });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn.mock.calls[1]?.[1]?.body).toBe(fetchFn.mock.calls[0]?.[1]?.body);
  });
});
