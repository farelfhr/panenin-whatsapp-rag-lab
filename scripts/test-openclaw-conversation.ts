import "dotenv/config";
import { randomBytes } from "node:crypto";
import { OpenClawClient } from "../src/agent/openclaw-client.js";
import { parseAgentEnv } from "../src/config/env.js";

async function main(): Promise<void> {
  const env = parseAgentEnv();
  if (!env.OPENCLAW_ENABLED) {
    throw new Error("Set OPENCLAW_ENABLED=true sebelum smoke test percakapan");
  }

  const client = new OpenClawClient({
    gatewayUrl: env.OPENCLAW_GATEWAY_URL,
    gatewayToken: env.OPENCLAW_GATEWAY_TOKEN,
    model: env.OPENCLAW_MODEL,
  });
  const internalUserId = `panenin:conversation-smoke-${randomBytes(6).toString("hex")}`;

  await client.run({
    internalUserId,
    message: "Untuk percakapan ini, komoditas saya adalah cabai rawit. Tanggapi singkat dan jangan mengulang pertanyaan.",
  });
  const followUp = await client.run({
    internalUserId,
    message: "Komoditas apa yang tadi saya sebut? Jawab hanya nama komoditasnya.",
  });

  if (!/cabai\s+rawit/i.test(followUp.text)) {
    throw new Error("OpenClaw merespons tetapi konteks multi-turn tidak terbukti");
  }
  console.log("OPENCLAW_CONVERSATION_OK");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Smoke test percakapan OpenClaw gagal");
  process.exitCode = 1;
});
