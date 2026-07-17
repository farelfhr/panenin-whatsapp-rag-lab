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
  const result = await client.run({ internalUserId: "panenin:manual-smoke-test", message: "Balas persis OPENCLAW_OK." });
  if (!result.text.includes("OPENCLAW_OK")) throw new Error("Gateway merespons tetapi hasil smoke test tidak sesuai");
  console.log("OPENCLAW_OK");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Smoke test OpenClaw gagal");
  process.exitCode = 1;
});
