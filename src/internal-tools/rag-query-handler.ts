import type { GeminiGateway } from "../ai/gemini-client.js";
import type { Retriever } from "../rag/retrieve.js";
import { answerKnowledge } from "../rag/answer.js";
import type { RagAnswer } from "../types/rag.js";
import { hasValidToolSecret } from "./authenticate.js";

const querySchema = {
  maxQuestionLength: 1_000,
};

export interface RagQueryHandlerDependencies {
  toolSecret: string;
  retriever: Retriever;
  gateway: GeminiGateway;
  answerFn?: (question: string, dependencies: { retriever: Retriever; gateway: GeminiGateway }) => Promise<RagAnswer>;
}

export function createRagQueryHandler(dependencies: RagQueryHandlerDependencies) {
  const answerFn = dependencies.answerFn ?? answerKnowledge;
  return async function handle(request: Request): Promise<Response> {
    if (request.method.toUpperCase() !== "POST") return json({ error: "method not allowed" }, 405);
    if (!hasValidToolSecret(request.headers.get("x-panenin-tool-secret"), dependencies.toolSecret)) {
      return json({ error: "unauthorized" }, 401);
    }
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "invalid JSON" }, 400);
    }
    if (!isRecord(payload) || typeof payload["question"] !== "string") {
      return json({ error: "question wajib berupa teks" }, 400);
    }
    if (payload["category"] !== undefined
      && (typeof payload["category"] !== "string" || payload["category"].trim().length > 100)) {
      return json({ error: "category tidak valid" }, 400);
    }
    const question = payload["question"].trim();
    if (question.length < 3 || question.length > querySchema.maxQuestionLength) {
      return json({ error: "question harus 3-1000 karakter" }, 400);
    }
    try {
      const result = await answerFn(question, { retriever: dependencies.retriever, gateway: dependencies.gateway });
      return json({ answer: result.answer, sources: result.sources.slice(0, 4) }, 200);
    } catch {
      return json({ error: "RAG tool tidak tersedia" }, 503);
    }
  };
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
