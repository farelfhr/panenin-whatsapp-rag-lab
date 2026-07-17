import "dotenv/config";
import { randomBytes } from "node:crypto";
import { OpenClawClient } from "../src/agent/openclaw-client.js";
import { parseAgentEnv } from "../src/config/env.js";

const forbiddenInternalTerms = /\b(?:panenin_rag_query|openclaw|similarity|system prompt)\b/i;
const rigidCommandLanguage = /(?:wajib|harus)\s+(?:ketik|gunakan)\s+(?:tanya|menu)/i;
const unsupportedTechnicalAdvice = /(?:natrium bikarbonat|residu pestisida|cold.?room|kadar air|Rp\s*[\d.]|°\s*C)/i;

async function main(): Promise<void> {
  const env = parseAgentEnv();
  if (!env.OPENCLAW_ENABLED) {
    throw new Error("Set OPENCLAW_ENABLED=true sebelum evaluasi percakapan natural");
  }
  const client = new OpenClawClient({
    gatewayUrl: env.OPENCLAW_GATEWAY_URL,
    gatewayToken: env.OPENCLAW_GATEWAY_TOKEN,
    model: env.OPENCLAW_MODEL,
  });
  const internalUserId = `panenin:natural-smoke-${randomBytes(6).toString("hex")}`;

  const opening = await client.run({
    internalUserId,
    message: "halo, aku agak bingung dan pengin ngobrol dulu",
  });
  assertNatural(opening.text);

  const context = await client.run({
    internalUserId,
    message: "cabai rawitku sekitar 200 kilo, kemungkinan siap minggu depan tapi aku belum tahu mulai dari mana",
  });
  assertNatural(context.text);
  if (context.text.length > 1_000) {
    throw new Error("Nara memberi respons WhatsApp terlalu panjang tanpa diminta");
  }
  if (unsupportedTechnicalAdvice.test(context.text)) {
    throw new Error("Nara memberi prosedur atau angka teknis yang tidak didukung");
  }
  if (/^\s*\d+\s*[.)]/m.test(context.text)) {
    throw new Error("Nara langsung memberi daftar langkah sebelum memahami tujuan pengguna");
  }
  if ((context.text.match(/\?/g) ?? []).length > 1) {
    throw new Error("Nara menanyakan terlalu banyak hal dalam satu balasan");
  }

  const analysis = await client.run({
    internalUserId,
    message: "bantu analisis prioritas paling penting dulu, santai aja bahasanya",
  });
  assertNatural(analysis.text);
  if (!/(?:cabai|200|panen|minggu depan)/i.test(analysis.text)) {
    throw new Error("Analisis tidak menunjukkan pemahaman konteks sesi");
  }
  if (/DRAFT DATA PANEN/i.test(analysis.text)) {
    throw new Error("Nara terlalu cepat mengubah percakapan menjadi formulir draft");
  }
  if ((analysis.text.match(/^\s*\d+\s*[.)]/gm) ?? []).length > 3) {
    throw new Error("Nara memberi lebih dari tiga prioritas dalam analisis singkat");
  }

  console.log("OPENCLAW_NATURAL_OK");
}

function assertNatural(text: string): void {
  if (text.trim().length < 3) throw new Error("Respons natural kosong");
  if (forbiddenInternalTerms.test(text)) throw new Error("Respons membocorkan istilah internal");
  if (rigidCommandLanguage.test(text)) throw new Error("Respons memaksa format command");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Evaluasi percakapan natural gagal");
  process.exitCode = 1;
});
