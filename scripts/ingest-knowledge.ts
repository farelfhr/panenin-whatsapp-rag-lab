import "dotenv/config";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { GeminiClient } from "../src/ai/gemini-client.js";
import { GeminiEmbeddingService } from "../src/ai/embedding.js";
import { parseGeminiEnv, parseSupabaseEnv } from "../src/config/env.js";
import { createSupabaseServerClient, SupabaseKnowledgeRepository } from "../src/database/supabase.js";
import { ingestDocument } from "../src/rag/ingest.js";
import { loadMarkdownDocument } from "../src/rag/chunker.js";

const geminiEnv = parseGeminiEnv();
const supabaseEnv = parseSupabaseEnv();
const client = new GeminiClient({ apiKey: geminiEnv.GEMINI_API_KEY, chatModel: geminiEnv.GEMINI_CHAT_MODEL, embeddingModel: geminiEnv.GEMINI_EMBEDDING_MODEL });
const repository = new SupabaseKnowledgeRepository(createSupabaseServerClient(supabaseEnv));
const embeddingService = new GeminiEmbeddingService(client, geminiEnv.GEMINI_EMBEDDING_DIMENSION);
const kbDirectory = join(process.cwd(), "kb");
const files = (await readdir(kbDirectory)).filter((file) => file.endsWith(".md")).sort();
for (const file of files) {
  const result = await ingestDocument(await loadMarkdownDocument(join(kbDirectory, file)), repository, embeddingService);
  console.log(`${file}: chunks=${result.chunkCount}`);
}
