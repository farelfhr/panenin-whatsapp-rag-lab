import "dotenv/config";
import { GeminiClient } from "../src/ai/gemini-client.js";
import { GeminiEmbeddingService } from "../src/ai/embedding.js";
import { GroqClient } from "../src/ai/groq-client.js";
import {
  parseGeminiEnv,
  parseGroqEnv,
  parseSupabaseEnv,
} from "../src/config/env.js";
import { createSupabaseServerClient, SupabaseKnowledgeRepository } from "../src/database/supabase.js";
import { answerKnowledge } from "../src/rag/answer.js";
import { SupabaseRetriever } from "../src/rag/retrieve.js";

const question = process.argv.slice(2).join(" ").trim() || "Bagaimana cara packing hasil panen?";
const geminiEnv = parseGeminiEnv();
const groqEnv = parseGroqEnv();
const supabaseEnv = parseSupabaseEnv();
const embeddingClient = new GeminiClient({
  apiKey: geminiEnv.GEMINI_API_KEY,
  chatModel: geminiEnv.GEMINI_CHAT_MODEL,
  embeddingModel: geminiEnv.GEMINI_EMBEDDING_MODEL,
});
const textClient = new GroqClient({
  apiKey: groqEnv.GROQ_API_KEY,
  baseUrl: groqEnv.GROQ_BASE_URL,
  model: groqEnv.GROQ_MODEL,
  fallbackModels: [groqEnv.GROQ_FALLBACK_MODEL, groqEnv.GROQ_TERTIARY_MODEL],
});
const repository = new SupabaseKnowledgeRepository(createSupabaseServerClient(supabaseEnv));
const result = await answerKnowledge(question, {
  retriever: new SupabaseRetriever(
    repository,
    new GeminiEmbeddingService(embeddingClient, geminiEnv.GEMINI_EMBEDDING_DIMENSION),
  ),
  gateway: textClient,
});
console.log(result.answer);
console.log("Sources:", JSON.stringify(result.sources));
