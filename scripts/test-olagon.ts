import "dotenv/config";
import { runOlagonPrompt } from "../src/agent/olagon-client.js";
import { parseOlagonTestEnv } from "../src/config/env.js";

async function main(): Promise<void> {
  const env = parseOlagonTestEnv();
  const text = await runOlagonPrompt({
    apiUrl: env.OLAGON_API_URL,
    apiKey: env.OLAGON_API_KEY,
    model: env.OLAGON_MODEL_ID,
    prompt: "Balas persis dengan kata OLAGON_OK.",
  });
  if (!text.includes("OLAGON_OK")) throw new Error("Olagon merespons tetapi hasil smoke test tidak sesuai");
  console.log("OLAGON_OK");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Smoke test Olagon gagal");
  process.exitCode = 1;
});
