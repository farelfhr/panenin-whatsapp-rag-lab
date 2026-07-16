export interface KnowledgeDocumentInput {
  title: string;
  category: string;
  version: number;
  status: "active" | "archived";
}

export interface KnowledgeChunkInput {
  chunkIndex: number;
  content: string;
  metadata: Record<string, string | number>;
  embedding: number[];
}

export interface KnowledgeMatch {
  chunkId: number | string;
  title: string;
  content: string;
  similarity: number;
}

export interface RagAnswer {
  answer: string;
  sources: Array<{
    title: string;
    similarity: number;
  }>;
}

export const NO_ANSWER =
  "Maaf, panduan tersebut belum tersedia dalam basis pengetahuan Panenin.";
