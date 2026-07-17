import "dotenv/config";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GeminiClient } from "./ai/gemini-client.js";
import { GeminiEmbeddingService } from "./ai/embedding.js";
import { GroqClient } from "./ai/groq-client.js";
import { handleProtectedRoute, SupabaseAuthVerifier } from "./auth/protected-route.js";
import { parseFullEnv } from "./config/env.js";
import {
  createSupabaseAuthClient,
  createSupabaseServerClient,
  SupabaseKnowledgeRepository,
  SupabaseWebhookStore,
} from "./database/supabase.js";
import { FonnteProvider } from "./messaging/fonnte-provider.js";
import { SupabaseRetriever } from "./rag/retrieve.js";
import { ConversationRouter } from "./conversation/router.js";
import { HybridConversationRouter } from "./conversation/hybrid-router.js";
import { OpenClawClient } from "./agent/openclaw-client.js";
import { createAgentSessionId } from "./agent/session-id.js";
import { createWebhookHandler } from "./webhook/handler.js";

export function createLabServer() {
  const env = parseFullEnv();
  const embeddingClient = new GeminiClient({
    apiKey: env.GEMINI_API_KEY,
    chatModel: env.GEMINI_CHAT_MODEL,
    embeddingModel: env.GEMINI_EMBEDDING_MODEL,
  });
  const textClient = new GroqClient({
    apiKey: env.GROQ_API_KEY,
    baseUrl: env.GROQ_BASE_URL,
    model: env.GROQ_MODEL,
    fallbackModels: [env.GROQ_FALLBACK_MODEL, env.GROQ_TERTIARY_MODEL],
  });
  const supabase = createSupabaseServerClient(env);
  const repository = new SupabaseKnowledgeRepository(supabase);
  const store = new SupabaseWebhookStore(supabase);
  const authVerifier = new SupabaseAuthVerifier(createSupabaseAuthClient(env));
  const provider = new FonnteProvider({ token: env.FONNTE_TOKEN });
  const retriever = new SupabaseRetriever(
    repository,
    new GeminiEmbeddingService(embeddingClient, env.GEMINI_EMBEDDING_DIMENSION),
  );
  const localRouter = new ConversationRouter({
    retriever,
    gateway: textClient,
    sessionStore: store,
  });
  const router = new HybridConversationRouter({
    localRouter,
    enabled: env.OPENCLAW_ENABLED,
    ...(env.OPENCLAW_ENABLED
      ? {
          agentGateway: new OpenClawClient({
            gatewayUrl: env.OPENCLAW_GATEWAY_URL,
            gatewayToken: env.OPENCLAW_GATEWAY_TOKEN,
            model: env.OPENCLAW_MODEL,
          }),
          sessionIdFactory: (sender: string) => createAgentSessionId(sender, env.AGENT_SESSION_HMAC_SECRET),
        }
      : {}),
  });
  const webhook = createWebhookHandler({
    provider,
    store,
    router,
    webhookSecret: env.FONNTE_WEBHOOK_SECRET,
    logInfo: (message) => console.info(message),
    logError: (message) => console.error(message),
  });

  return createServer(async (request, response) => {
    if (request.url === "/health" && request.method === "GET") {
      writeResponse(response, new Response("ok", { status: 200 }));
      return;
    }
    if (request.url?.split("?")[0] === "/api/protected") {
      const authorization = typeof request.headers.authorization === "string"
        ? request.headers.authorization
        : undefined;
      writeResponse(
        response,
        await handleProtectedRoute(request.method ?? "GET", authorization, authVerifier),
      );
      return;
    }
    if (request.url?.split("?")[0] !== "/webhook/fonnte") {
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
    const webRequest = new Request(`http://${request.headers.host ?? "localhost"}${request.url ?? "/webhook/fonnte"}`, { method: request.method ?? "POST", headers, body });
    writeResponse(response, await webhook(webRequest));
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
if (entrypointPath && entrypointPath === fileURLToPath(import.meta.url)) {
  const port = Number(process.env["PORT"] ?? 3000);
  createLabServer().listen(port, () => console.log(`Panenin lab listening on http://localhost:${port}`));
}
