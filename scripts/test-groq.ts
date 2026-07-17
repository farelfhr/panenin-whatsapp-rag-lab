import "dotenv/config";
import { GroqClient } from "../src/ai/groq-client.js";
import { parseGroqEnv } from "../src/config/env.js";

const env = parseGroqEnv();
const client = new GroqClient({
  apiKey: env.GROQ_API_KEY,
  baseUrl: env.GROQ_BASE_URL,
  model: env.GROQ_MODEL,
});
const text = await client.generateText({
  systemInstruction: "Ikuti instruksi pengguna secara tepat.",
  prompt: "Balas persis dengan kata GROQ_OK.",
});

if (!text.includes("GROQ_OK")) {
  throw new Error("Groq merespons tetapi hasil smoke test tidak sesuai");
}
console.log("GROQ_OK");
