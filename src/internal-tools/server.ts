import "dotenv/config";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { GeminiClient } from "../ai/gemini-client.js";
import { GeminiEmbeddingService } from "../ai/embedding.js";
import { GroqClient } from "../ai/groq-client.js";
import {
  parseGeminiEnv,
  parseGroqEnv,
  parseInternalToolEnv,
  parseSupabaseEnv,
} from "../config/env.js";
import { createSupabaseServerClient, SupabaseKnowledgeRepository } from "../database/supabase.js";
import { answerKnowledge } from "../rag/answer.js";
import { SupabaseRetriever } from "../rag/retrieve.js";
import { createRagQueryHandler } from "./rag-query-handler.js";

export function createInternalToolServer() {
  const toolEnv = parseInternalToolEnv();
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
  const retriever = new SupabaseRetriever(
    repository,
    new GeminiEmbeddingService(embeddingClient, geminiEnv.GEMINI_EMBEDDING_DIMENSION),
  );
  const ragHandler = createRagQueryHandler({
    toolSecret: toolEnv.PANENIN_TOOL_SECRET,
    retriever,
    gateway: textClient,
    answerFn: answerKnowledge,
  });

  return createServer(async (request, response) => {
    if (request.url?.split("?")[0] !== "/internal/tools/rag-query") {
      writeResponse(response, new Response("not found", { status: 404 }));
      return;
    }
    let body: string;
    try {
      body = await readBody(request, 1_000_000);
    } catch {
      writeResponse(response, new Response("request body too large or unreadable", { status: 413 }));
      return;
    }
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (typeof value === "string") headers.set(key, value);
      else if (Array.isArray(value)) headers.set(key, value.join(","));
    }
    const requestUrl = `http://${request.headers.host ?? "127.0.0.1"}${request.url ?? "/internal/tools/rag-query"}`;
    const method = request.method ?? "POST";
    const init = method.toUpperCase() === "GET" || method.toUpperCase() === "HEAD"
      ? { method, headers }
      : { method, headers, body };
    writeResponse(response, await ragHandler(new Request(requestUrl, init)));
  }).listen(toolEnv.INTERNAL_TOOL_PORT, toolEnv.INTERNAL_TOOL_HOST, () => {
    console.log(`Panenin internal RAG tool listening on http://${toolEnv.INTERNAL_TOOL_HOST}:${toolEnv.INTERNAL_TOOL_PORT}`);
  });
}

async function readBody(request: IncomingMessage, maxBytes: number): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) throw new Error("request body too large");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function writeResponse(response: ServerResponse, result: Response): void {
  response.statusCode = result.status;
  result.headers.forEach((value, key) => response.setHeader(key, value));
  void result.text().then((body) => response.end(body));
}

const entrypointPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (entrypointPath && entrypointPath === fileURLToPath(import.meta.url)) createInternalToolServer();
