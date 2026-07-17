import { describe, expect, it, vi } from "vitest";
import { Type } from "@google/genai";
import { GroqClient } from "../src/ai/groq-client.js";

const fakeApiKey = "test-key-not-a-real-secret-123";

describe("GroqClient", () => {
  it("mengirim chat OpenAI-compatible dengan bearer token dan model terpilih", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      choices: [{ message: { content: "Halo dari Groq" } }],
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    const client = new GroqClient({
      apiKey: fakeApiKey,
      model: "llama-3.3-70b-versatile",
      fetch: fetchMock as typeof fetch,
      maxRetries: 0,
    });

    await expect(client.generateText({
      systemInstruction: "Jawab singkat.",
      prompt: "Halo",
    })).resolves.toBe("Halo dari Groq");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(init?.headers).toMatchObject({
      authorization: `Bearer ${fakeApiKey}`,
      "content-type": "application/json",
    });
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body["model"]).toBe("llama-3.3-70b-versatile");
    expect(body["messages"]).toEqual([
      { role: "system", content: "Jawab singkat." },
      { role: "user", content: "Halo" },
    ]);
  });

  it("meminta JSON mode untuk keluaran terstruktur", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      choices: [{ message: { content: "{\"ok\":true}" } }],
    }), { status: 200 }));
    const client = new GroqClient({
      apiKey: fakeApiKey,
      model: "llama-3.3-70b-versatile",
      fetch: fetchMock as typeof fetch,
      maxRetries: 0,
    });

    await client.generateText({
      prompt: "Keluarkan JSON.",
      responseSchema: {
        type: Type.OBJECT,
        properties: { ok: { type: Type.BOOLEAN } },
        required: ["ok"],
      },
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(body["response_format"]).toEqual({ type: "json_object" });
    expect(body["temperature"]).toBe(0);
  });

  it("tidak membocorkan body error provider", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(
      JSON.stringify({ error: { message: "sensitive-provider-detail" } }),
      { status: 401 },
    ));
    const client = new GroqClient({
      apiKey: fakeApiKey,
      model: "llama-3.3-70b-versatile",
      fetch: fetchMock as typeof fetch,
      maxRetries: 0,
    });

    const error = await client.generateText({ prompt: "Halo" }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Groq HTTP 401");
    expect((error as Error).message).not.toContain("sensitive-provider-detail");
  });

  it("me-retry 429 terbatas untuk request generasi yang aman", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: "berhasil" } }],
      }), { status: 200 }));
    const client = new GroqClient({
      apiKey: fakeApiKey,
      model: "llama-3.3-70b-versatile",
      fetch: fetchMock as typeof fetch,
      maxRetries: 1,
    });

    await expect(client.generateText({ prompt: "Halo" })).resolves.toBe("berhasil");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("beralih ke model fallback ketika model utama tetap terkena 429", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: "jawaban fallback" } }],
      }), { status: 200 }));
    const client = new GroqClient({
      apiKey: fakeApiKey,
      model: "llama-3.3-70b-versatile",
      fallbackModels: ["llama-3.1-8b-instant"],
      fetch: fetchMock,
      maxRetries: 0,
    });

    await expect(client.generateText({ prompt: "Halo" })).resolves.toBe("jawaban fallback");
    const firstBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as Record<string, unknown>;
    expect(firstBody["model"]).toBe("llama-3.3-70b-versatile");
    expect(secondBody["model"]).toBe("llama-3.1-8b-instant");
  });
});
