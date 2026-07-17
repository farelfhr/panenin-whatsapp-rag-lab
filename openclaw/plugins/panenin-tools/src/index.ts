import { Type } from "typebox";
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";

interface RagToolResponse {
  answer: string;
  sources: Array<{ title: string; similarity: number }>;
}

export async function queryPaneninRag(input: {
  question: string;
  category?: string;
  toolUrl: string;
  toolSecret: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}): Promise<RagToolResponse> {
  const question = input.question.trim();
  if (question.length < 3 || question.length > 1_000) throw new Error("question harus 3-1000 karakter");
  if (!isAllowedToolUrl(input.toolUrl)) throw new Error("tool URL harus endpoint RAG pada loopback");
  if (input.toolSecret.length < 24) throw new Error("tool secret tidak valid");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 20_000);
  try {
    const response = await (input.fetchFn ?? fetch)(input.toolUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-panenin-tool-secret": input.toolSecret,
      },
      body: JSON.stringify({ question, ...(input.category ? { category: input.category.trim() } : {}) }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Panenin RAG HTTP ${response.status}`);
    const payload: unknown = await response.json();
    if (!isRagToolResponse(payload)) throw new Error("respons Panenin RAG tidak valid");
    return { answer: payload.answer, sources: payload.sources.slice(0, 4) };
  } finally {
    clearTimeout(timer);
  }
}

export function isAllowedToolUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:"
      && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
      && url.pathname === "/internal/tools/rag-query"
      && !url.username
      && !url.password;
  } catch {
    return false;
  }
}

export default defineToolPlugin({
  id: "panenin-tools",
  name: "Panenin Tools",
  description: "Read-only access to the Panenin knowledge RAG service.",
  configSchema: Type.Object({
    toolUrl: Type.Optional(Type.String()),
  }, { additionalProperties: false }),
  tools: (tool) => [
    tool({
      name: "panenin_rag_query",
      label: "Panenin RAG Query",
      description: "Cari SOP dan pengetahuan Panenin secara read-only. Tool ini tidak boleh dipakai untuk transaksi atau mutasi data.",
      optional: true,
      parameters: Type.Object({
        question: Type.String({ minLength: 3, maxLength: 1_000 }),
        category: Type.Optional(Type.String({ maxLength: 100 })),
      }, { additionalProperties: false }),
      async execute({ question, category }, config) {
        const toolUrl = config.toolUrl ?? process.env["PANENIN_RAG_TOOL_URL"] ?? "";
        const toolSecret = process.env["PANENIN_TOOL_SECRET"] ?? "";
        const result = await queryPaneninRag({
          question,
          ...(category ? { category } : {}),
          toolUrl,
          toolSecret,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
          details: result,
        };
      },
    }),
  ],
});

function isRagToolResponse(value: unknown): value is RagToolResponse {
  if (!isRecord(value) || typeof value["answer"] !== "string" || !Array.isArray(value["sources"])) return false;
  return value["sources"].every((source) => isRecord(source)
    && typeof source["title"] === "string"
    && typeof source["similarity"] === "number");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
