import type { EmbeddingService } from "../ai/embedding.js";
import type { KnowledgeChunkInput, KnowledgeDocumentInput } from "../types/rag.js";
import { chunkDocument, type ParsedKnowledgeDocument } from "./chunker.js";

export interface KnowledgeRepository {
  upsertDocument(input: KnowledgeDocumentInput): Promise<string>;
  replaceChunks(documentId: string, chunks: KnowledgeChunkInput[]): Promise<void>;
  matchKnowledge(input: { embedding: number[]; threshold: number; count: number }): Promise<import("../types/rag.js").KnowledgeMatch[]>;
}

export async function ingestDocument(
  document: ParsedKnowledgeDocument,
  repository: KnowledgeRepository,
  embeddingService: EmbeddingService,
): Promise<{ documentId: string; chunkCount: number }> {
  const documentId = await repository.upsertDocument({
    title: document.title,
    category: document.category,
    version: document.version,
    status: document.status,
  });
  const chunks = chunkDocument(document);
  const embeddedChunks: KnowledgeChunkInput[] = [];
  for (const chunk of chunks) {
    embeddedChunks.push({
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      metadata: chunk.metadata,
      embedding: await embeddingService.embed(chunk.content),
    });
  }
  await repository.replaceChunks(documentId, embeddedChunks);
  return { documentId, chunkCount: embeddedChunks.length };
}
