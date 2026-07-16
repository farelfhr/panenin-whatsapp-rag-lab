import type { EmbeddingService } from "../ai/embedding.js";
import type { KnowledgeMatch } from "../types/rag.js";
import type { KnowledgeRepository } from "./ingest.js";

export interface Retriever {
  retrieve(question: string): Promise<KnowledgeMatch[]>;
}

export class SupabaseRetriever implements Retriever {
  public constructor(
    private readonly repository: KnowledgeRepository,
    private readonly embeddingService: EmbeddingService,
    private readonly threshold = 0.62,
    private readonly count = 5,
  ) {}

  public async retrieve(question: string): Promise<KnowledgeMatch[]> {
    const trimmed = question.trim();
    if (trimmed.length < 3) return [];
    const embedding = await this.embeddingService.embed(trimmed);
    return this.repository.matchKnowledge({
      embedding,
      threshold: this.threshold,
      count: this.count,
    });
  }
}
