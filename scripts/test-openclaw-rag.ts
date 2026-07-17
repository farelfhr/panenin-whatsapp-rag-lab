import "dotenv/config";
import { z } from "zod";
import { OpenClawClient } from "../src/agent/openclaw-client.js";
import { parseAgentEnv } from "../src/config/env.js";

const toolResponseSchema = z.object({
  answer: z.string().min(1),
  sources: z.array(z.object({
    title: z.string(),
    similarity: z.number(),
  })),
});

async function main(): Promise<void> {
  const env = parseAgentEnv();
  if (!env.OPENCLAW_ENABLED) throw new Error("Set OPENCLAW_ENABLED=true sebelum smoke test");
  const toolResponse = await fetch(env.PANENIN_RAG_TOOL_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-panenin-tool-secret": env.PANENIN_TOOL_SECRET,
    },
    body: JSON.stringify({ question: "Apa panduan persiapan panen?" }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!toolResponse.ok) throw new Error(`Internal RAG tool HTTP ${toolResponse.status}`);
  const toolResult = toolResponseSchema.safeParse(await toolResponse.json());
  if (!toolResult.success) throw new Error("Respons internal RAG tool tidak valid");

  const client = new OpenClawClient({
    gatewayUrl: env.OPENCLAW_GATEWAY_URL,
    gatewayToken: env.OPENCLAW_GATEWAY_TOKEN,
    model: env.OPENCLAW_MODEL,
  });
  const result = await client.run({
    internalUserId: "panenin:manual-rag-smoke-test",
    message: "Gunakan panenin_rag_query untuk mencari panduan Panenin tentang persiapan panen. Jawab singkat.",
  });
  if (result.text.trim().length < 5) throw new Error("Respons RAG melalui OpenClaw kosong");
  console.log("OPENCLAW_RAG_OK");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Smoke test OpenClaw RAG gagal");
  process.exitCode = 1;
});
