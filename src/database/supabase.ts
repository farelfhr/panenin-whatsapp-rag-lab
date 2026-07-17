import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { FonnteEnv, SupabaseEnv } from "../config/env.js";
import type { NormalizedIncomingMessage } from "../types/messaging.js";
import type { KnowledgeMatch, KnowledgeChunkInput, KnowledgeDocumentInput } from "../types/rag.js";
import type { KnowledgeRepository } from "../rag/ingest.js";
import { sanitizePayload } from "../webhook/sanitize.js";

export const PANENIN_AI_LAB_SCHEMA = "panenin_ai_lab";

export function createSupabaseServerClient(config: SupabaseEnv) {
  return createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: PANENIN_AI_LAB_SCHEMA },
  });
}

export type PaneninLabSupabaseClient = ReturnType<typeof createSupabaseServerClient>;

export function createSupabaseAuthClient(config: SupabaseEnv): SupabaseClient {
  return createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export class SupabaseKnowledgeRepository implements KnowledgeRepository {
  public constructor(private readonly client: PaneninLabSupabaseClient) {}

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
      throw createSupabaseOperationError(
        "Supabase gagal menyimpan knowledge document",
        error,
      );
    }
    return data["id"];
  }

  public async replaceChunks(documentId: string, chunks: KnowledgeChunkInput[]): Promise<void> {
    const { error: deleteError } = await this.client
      .from("knowledge_chunks")
      .delete()
      .eq("document_id", documentId);
    if (deleteError) {
      throw createSupabaseOperationError(
        "Supabase gagal menghapus chunk knowledge lama",
        deleteError,
      );
    }

    if (chunks.length === 0) return;
    const rows = chunks.map((chunk) => ({
      document_id: documentId,
      chunk_index: chunk.chunkIndex,
      content: chunk.content,
      metadata: chunk.metadata,
      embedding: chunk.embedding,
    }));
    const { error } = await this.client.from("knowledge_chunks").insert(rows);
    if (error) {
      throw createSupabaseOperationError(
        "Supabase gagal menyimpan chunk knowledge",
        error,
      );
    }
  }

  public async matchKnowledge(input: { embedding: number[]; threshold: number; count: number }): Promise<KnowledgeMatch[]> {
    const { data, error } = await this.client.rpc("match_knowledge", {
      query_embedding: input.embedding,
      match_threshold: input.threshold,
      match_count: input.count,
    });
    if (error || !Array.isArray(data)) {
      throw createSupabaseOperationError(
        "Supabase gagal mengambil knowledge",
        error,
      );
    }
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
  markIncomingStatus(
    providerMessageId: string,
    status: "processed" | "failed",
  ): Promise<void>;
  resetSession(sender: string): Promise<void>;
}

export class SupabaseWebhookStore implements WebhookStore {
  public constructor(private readonly client: PaneninLabSupabaseClient) {}

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
    throw createSupabaseOperationError(
      "Supabase gagal menyimpan incoming message",
      error,
    );
  }

  public async markIncomingStatus(
    providerMessageId: string,
    status: "processed" | "failed",
  ): Promise<void> {
    const { error } = await this.client
      .from("incoming_messages")
      .update({ status })
      .eq("provider_message_id", providerMessageId);
    if (error) {
      throw createSupabaseOperationError(
        "Supabase gagal memperbarui status incoming message",
        error,
      );
    }
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
    if (error) {
      throw createSupabaseOperationError(
        "Supabase gagal mereset conversation session",
        error,
      );
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createSupabaseOperationError(
  operation: string,
  error: { code?: string; message?: string; hint?: string } | null,
): Error {
  if (!error) return new Error(operation);

  const context = [
    safeErrorField(error.code),
    safeErrorField(error.message),
    safeErrorField(error.hint),
  ].filter((value): value is string => value !== null);

  return new Error(context.length > 0
    ? `${operation}: ${context.join(" | ")}`
    : operation);
}

function safeErrorField(value: string | undefined): string | null {
  if (!value) return null;
  return value.replace(/[\r\n]+/g, " ").slice(0, 500);
}

export function createWebhookStore(config: SupabaseEnv & FonnteEnv): WebhookStore {
  return new SupabaseWebhookStore(createSupabaseServerClient(config));
}
