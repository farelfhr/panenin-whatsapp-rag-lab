import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { FonnteEnv, SupabaseEnv } from "../config/env.js";
import type { NormalizedIncomingMessage } from "../types/messaging.js";
import type { KnowledgeMatch, KnowledgeChunkInput, KnowledgeDocumentInput } from "../types/rag.js";
import type { KnowledgeRepository } from "../rag/ingest.js";
import { sanitizePayload } from "../webhook/sanitize.js";

export function createSupabaseServerClient(config: SupabaseEnv): SupabaseClient {
  return createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export class SupabaseKnowledgeRepository implements KnowledgeRepository {
  public constructor(private readonly client: SupabaseClient) {}

  public async upsertDocument(input: KnowledgeDocumentInput): Promise<string> {
    const { data, error } = await this.client
      .from("knowledge_documents")
      .upsert(
        {
          title: input.title,
          category: input.category,
          status: input.status,
          version: input.version,
        },
        { onConflict: "title,version" },
      )
      .select("id")
      .single();
    if (error || !data || typeof data["id"] !== "string") {
      throw new Error("Supabase gagal menyimpan knowledge document");
    }
    return data["id"];
  }

  public async replaceChunks(documentId: string, chunks: KnowledgeChunkInput[]): Promise<void> {
    const { error: deleteError } = await this.client
      .from("knowledge_chunks")
      .delete()
      .eq("document_id", documentId);
    if (deleteError) throw new Error("Supabase gagal menghapus chunk knowledge lama");

    if (chunks.length === 0) return;
    const rows = chunks.map((chunk) => ({
      document_id: documentId,
      chunk_index: chunk.chunkIndex,
      content: chunk.content,
      metadata: chunk.metadata,
      embedding: chunk.embedding,
    }));
    const { error } = await this.client.from("knowledge_chunks").insert(rows);
    if (error) throw new Error("Supabase gagal menyimpan chunk knowledge");
  }

  public async matchKnowledge(input: { embedding: number[]; threshold: number; count: number }): Promise<KnowledgeMatch[]> {
    const { data, error } = await this.client.rpc("match_knowledge", {
      query_embedding: input.embedding,
      match_threshold: input.threshold,
      match_count: input.count,
    });
    if (error || !Array.isArray(data)) throw new Error("Supabase gagal mengambil knowledge");
    return data.flatMap((row: unknown) => {
      if (!isRecord(row) || typeof row["title"] !== "string" || typeof row["content"] !== "string" || typeof row["similarity"] !== "number") {
        return [];
      }
      const chunkId = typeof row["chunk_id"] === "string" || typeof row["chunk_id"] === "number" ? row["chunk_id"] : "unknown";
      return [{ chunkId, title: row["title"], content: row["content"], similarity: row["similarity"] }];
    });
  }
}

export interface WebhookStore {
  claimIncoming(message: NormalizedIncomingMessage, sanitizedRaw: unknown): Promise<boolean>;
  resetSession(sender: string): Promise<void>;
}

export class SupabaseWebhookStore implements WebhookStore {
  public constructor(private readonly client: SupabaseClient) {}

  public async claimIncoming(message: NormalizedIncomingMessage, sanitizedRaw: unknown): Promise<boolean> {
    const { error } = await this.client.from("incoming_messages").insert({
      provider_message_id: message.providerMessageId,
      sender: message.sender,
      message_type: message.type,
      text_body: message.text ?? null,
      raw_payload: sanitizePayload(sanitizedRaw),
      status: "received",
    });
    if (!error) return true;
    if (error.code === "23505") return false;
    throw new Error("Supabase gagal menyimpan incoming message");
  }

  public async resetSession(sender: string): Promise<void> {
    const { error } = await this.client.from("conversation_sessions").upsert({
      sender,
      current_intent: null,
      state: "idle",
      context: {},
      expires_at: null,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("Supabase gagal mereset conversation session");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createWebhookStore(config: SupabaseEnv & FonnteEnv): WebhookStore {
  return new SupabaseWebhookStore(createSupabaseServerClient(config));
}
