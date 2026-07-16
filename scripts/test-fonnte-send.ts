import "dotenv/config";
import { parseFonnteEnv } from "../src/config/env.js";
import { FonnteProvider } from "../src/messaging/fonnte-provider.js";

const target = process.argv[2];
if (!target) throw new Error("Berikan target: npm run fonnte:test -- 6281234567890");
const env = parseFonnteEnv();
const provider = new FonnteProvider({ token: env.FONNTE_TOKEN });
const result = await provider.sendText({ to: target, text: "Halo dari Panenin Integration Lab" });
console.log("Fonnte outbound OK", result.providerMessageId ? "provider id diterima" : "tanpa provider id");
