import { env } from "process";
import { getDb } from "../../db";
import { documents, documentChunks, InsertDocumentChunk } from "../../../drizzle/schema";

/**
 * Split text into chunks by sentences and paragraphs.
 * Aim for ~500 tokens per chunk (~2000 chars).
 */
export function chunkText(text: string, maxChunkSize: number = 2000): string[] {
  const chunks: string[] = [];
  let currentChunk = "";

  // Split by paragraphs first
  const paragraphs = text.split(/\n\n+/);

  for (const paragraph of paragraphs) {
    if ((currentChunk + paragraph).length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = paragraph;
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Generate embedding for text using @xenova/transformers (all-MiniLM-L6-v2).
 * Returns a vector as JSON string for storage.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const { pipeline } = await import("@xenova/transformers");
    const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    const result = await extractor(text, { pooling: "mean", normalize: true });

    // Convert to array
    if (result && typeof result === "object" && "data" in result) {
      return Array.from((result as any).data);
    }
    return [];
  } catch (error) {
    console.error("[RAG] Embedding generation failed:", error);
    return [];
  }
}

/**
 * Ingest a document: chunk it, generate embeddings, and store in DB.
 */
export async function ingestDocument(
  title: string,
  docType: string,
  content: string,
  effectiveDate: Date
): Promise<{ docId: number; chunkCount: number }> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Insert document
  const result = await db
    .insert(documents)
    .values({
      title,
      docType,
      content,
      effectiveDate,
    })
    .returning({ id: documents.id });

  const docId = result[0].id;

  // Chunk and embed
  const chunks = chunkText(content);
  const chunkRecords: InsertDocumentChunk[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = await generateEmbedding(chunk);

    chunkRecords.push({
      docId,
      section: `Section ${i + 1}`,
      content: chunk,
      embedding: JSON.stringify(embedding),
    });
  }

  // Batch insert chunks
  if (chunkRecords.length > 0) {
    await db.insert(documentChunks).values(chunkRecords);
  }

  return { docId, chunkCount: chunks.length };
}

/**
 * Retrieve relevant chunks from the vector store using cosine similarity.
 * Returns top K chunks with similarity scores.
 */
export async function retrieveChunks(
  query: string,
  topK: number = 3
): Promise<
  Array<{
    docId: number;
    section: string;
    content: string;
    similarity: number;
  }>
> {
  const db = await getDb();
  if (!db) {
    console.warn("[RAG] Database not available — returning no chunks.");
    return [];
  }

  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query);
  if (queryEmbedding.length === 0) {
    return [];
  }

  // Fetch all chunks and compute similarity in-process
  const allChunks = await db.select().from(documentChunks);

  const similarities = allChunks
    .map((chunk) => {
      const chunkEmbedding = JSON.parse(chunk.embedding) as number[];
      const similarity = cosineSimilarity(queryEmbedding, chunkEmbedding);
      return {
        docId: chunk.docId,
        section: chunk.section,
        content: chunk.content,
        similarity,
      };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  return similarities;
}

/**
 * Compute cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}
