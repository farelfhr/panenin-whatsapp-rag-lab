import "dotenv/config";
import { GeminiClient } from "../src/ai/gemini-client.js";
import { GeminiEmbeddingService } from "../src/ai/embedding.js";
import { parseGeminiEnv } from "../src/config/env.js";

const env = parseGeminiEnv();
const client = new GeminiClient({ apiKey: env.GEMINI_API_KEY, chatModel: env.GEMINI_CHAT_MODEL, embeddingModel: env.GEMINI_EMBEDDING_MODEL });
const service = new GeminiEmbeddingService(client, env.GEMINI_EMBEDDING_DIMENSION);
const vector = await service.embed("Panenin membantu rantai pasok pangan.");
console.log(`Embedding OK: dimension=${vector.length}`);
