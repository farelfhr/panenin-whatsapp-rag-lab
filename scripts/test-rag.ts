import "dotenv/config";
import { GeminiClient } from "../src/ai/gemini-client.js";
import { GeminiEmbeddingService } from "../src/ai/embedding.js";
import { parseGeminiEnv, parseSupabaseEnv } from "../src/config/env.js";
import { createSupabaseServerClient, SupabaseKnowledgeRepository } from "../src/database/supabase.js";
import { answerKnowledge } from "../src/rag/answer.js";
import { SupabaseRetriever } from "../src/rag/retrieve.js";

const question = process.argv.slice(2).join(" ").trim() || "Bagaimana cara packing hasil panen?";
const geminiEnv = parseGeminiEnv();
const supabaseEnv = parseSupabaseEnv();
const client = new GeminiClient({ apiKey: geminiEnv.GEMINI_API_KEY, chatModel: geminiEnv.GEMINI_CHAT_MODEL, embeddingModel: geminiEnv.GEMINI_EMBEDDING_MODEL });
const repository = new SupabaseKnowledgeRepository(createSupabaseServerClient(supabaseEnv));
const result = await answerKnowledge(question, {
  retriever: new SupabaseRetriever(repository, new GeminiEmbeddingService(client, geminiEnv.GEMINI_EMBEDDING_DIMENSION)),
  gateway: client,
});
console.log(result.answer);
console.log("Sources:", JSON.stringify(result.sources));
