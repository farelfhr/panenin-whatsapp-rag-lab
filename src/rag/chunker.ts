import { readFile } from "node:fs/promises";
import { z } from "zod";

const frontmatterSchema = z.object({
  title: z.string().trim().min(1),
  category: z.string().trim().min(1),
  version: z.coerce.number().int().positive(),
  status: z.enum(["active", "archived"]).default("active"),
});

export interface ParsedKnowledgeDocument {
  title: string;
  category: string;
  version: number;
  status: "active" | "archived";
  content: string;
}

export interface KnowledgeChunk {
  chunkIndex: number;
  content: string;
  metadata: Record<string, string | number>;
}

export function parseMarkdownDocument(markdown: string): ParsedKnowledgeDocument {
  const normalized = markdown.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    throw new Error("Knowledge markdown harus memiliki frontmatter");
  }
  const end = normalized.indexOf("\n---", 4);
  if (end < 0) {
    throw new Error("Frontmatter knowledge tidak ditutup dengan benar");
  }

  const frontmatterLines = normalized.slice(4, end).split("\n");
  const fields: Record<string, string> = {};
  for (const line of frontmatterLines) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    fields[key] = value;
  }

  const parsed = frontmatterSchema.safeParse(fields);
  if (!parsed.success) {
    throw new Error(`Frontmatter knowledge tidak valid: ${parsed.error.issues.map((issue) => issue.message).join(", ")}`);
  }

  const content = normalized.slice(end + "\n---".length).trim();
  if (!content) throw new Error("Konten knowledge kosong");
  return { ...parsed.data, content };
}

export async function loadMarkdownDocument(path: string): Promise<ParsedKnowledgeDocument> {
  return parseMarkdownDocument(await readFile(path, "utf8"));
}

export function chunkText(
  content: string,
  options: { targetWords?: number; overlapWords?: number } = {},
): KnowledgeChunk[] {
  const targetWords = options.targetWords ?? 250;
  const overlapWords = options.overlapWords ?? 40;
  if (targetWords < 150 || targetWords > 400) throw new Error("targetWords harus 150-400");
  if (overlapWords < 30 || overlapWords > 60 || overlapWords >= targetWords) {
    throw new Error("overlapWords harus 30-60 dan lebih kecil dari targetWords");
  }

  const words = content.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const chunks: KnowledgeChunk[] = [];
  const step = targetWords - overlapWords;
  let start = 0;
  let chunkIndex = 0;
  while (start < words.length) {
    const end = Math.min(start + targetWords, words.length);
    chunks.push({
      chunkIndex,
      content: words.slice(start, end).join(" "),
      metadata: { chunkIndex, wordCount: end - start },
    });
    if (end === words.length) break;
    start += step;
    chunkIndex += 1;
  }
  return chunks;
}

export function chunkDocument(document: ParsedKnowledgeDocument): KnowledgeChunk[] {
  return chunkText(document.content).map((chunk) => ({
    ...chunk,
    metadata: {
      ...chunk.metadata,
      title: document.title,
      category: document.category,
      version: document.version,
    },
  }));
}
