import "dotenv/config";
import { OpenClawClient } from "../src/agent/openclaw-client.js";
import { parseAgentEnv } from "../src/config/env.js";

async function main(): Promise<void> {
  const env = parseAgentEnv();
  if (!env.OPENCLAW_ENABLED) throw new Error("Set OPENCLAW_ENABLED=true sebelum smoke test");
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
