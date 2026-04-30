import mongoose from "mongoose";
import { embed } from "@wup/ingestor";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RetrievedChunk {
  text: string;
  score: number;
  metadata: {
    sourceFile: string;
    pageNumber: number;
    chunkIndex: number;
    sourceId: string;
  };
}

// ─── Config ───────────────────────────────────────────────────────────────────

/** MongoDB Atlas Vector Search index name — must match what you create in Atlas UI */
const VECTOR_INDEX_NAME = "knowledge_vector_index";

/** Top-K chunks to retrieve before score filtering */
const TOP_K = 6;

/** ANN candidates — higher = more accurate, slower. 100 is the Atlas recommended default */
const NUM_CANDIDATES = 100;

/** Minimum cosine similarity score to include a chunk in the context (R-5) */
const MIN_SCORE_THRESHOLD = 0.72;

/** Hard timeout for the entire retrieval operation in ms (R-8) */
const RETRIEVAL_TIMEOUT_MS = 5000;

/** Max characters to use from the query for embedding (R-7) */
const MAX_QUERY_CHARS = 2000;

/** Max total characters of RAG context injected into the prompt (L-1) */
export const MAX_RAG_CONTEXT_CHARS = 8000;

// ─── RAG Service ─────────────────────────────────────────────────────────────

export class RAGService {
  /**
   * Retrieves the most semantically similar document chunks for a given query.
   *
   * This is wrapped in safeRetrieve() in the orchestrator — failures here
   * are caught and treated as "no context available" (graceful degradation).
   *
   * Security: filter always includes userId — users can ONLY see their own chunks (S-1).
   */
  async retrieve(
    userId: string,
    rawQuery: string
  ): Promise<RetrievedChunk[]> {
    // R-7: Truncate very long queries before embedding
    const query = rawQuery.slice(0, MAX_QUERY_CHARS);

    // Step 1: Embed the query
    const queryVector = await embed(query);

    // Step 2: Atlas $vectorSearch — S-1: ALWAYS filter by userId
    const KnowledgeChunk = mongoose.model("KnowledgeChunk");

    const results = await KnowledgeChunk.aggregate([
      {
        $vectorSearch: {
          index: VECTOR_INDEX_NAME,
          path: "embedding",
          queryVector,
          numCandidates: NUM_CANDIDATES,
          limit: TOP_K,
          // S-1: Critical — scopes search to ONLY this user's documents
          filter: { userId: new mongoose.Types.ObjectId(userId) },
        },
      },
      {
        $project: {
          // Explicit inclusion only (S-7: Never return raw embeddings)
          text: 1,
          "metadata.sourceFile": 1,
          "metadata.pageNumber": 1,
          "metadata.chunkIndex": 1,
          _sourceId: "$sourceId",
          score: { $meta: "vectorSearchScore" },
        },
      },
    ]);

    // R-5: Filter out low-relevance chunks
    const relevant = results.filter(
      (r: any) => typeof r.score === "number" && r.score >= MIN_SCORE_THRESHOLD
    );

    return relevant.map((r: any) => ({
      text: r.text as string,
      score: r.score as number,
      metadata: {
        sourceFile: r.metadata?.sourceFile ?? "Unknown",
        pageNumber: r.metadata?.pageNumber ?? 0,
        chunkIndex: r.metadata?.chunkIndex ?? 0,
        sourceId: r._sourceId?.toString() ?? "",
      },
    }));
  }
}

// ─── Helpers exported for orchestrator ───────────────────────────────────────

/**
 * Non-blocking RAG wrapper used in BrainOrchestrator.ask().
 *
 * Implements the Golden Rule: RAG failure must ALWAYS be silent.
 * Any error (embed fail, Atlas down, timeout, index missing) returns []
 * and the LLM answers from general knowledge + chat history only. (R-1 → R-8)
 */
export async function safeRetrieve(
  ragService: RAGService,
  userId: string,
  query: string
): Promise<RetrievedChunk[]> {
  try {
    const retrievalPromise = ragService.retrieve(userId, query);

    // R-8: Hard timeout — Atlas must respond within 5 seconds
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("RAG_TIMEOUT")),
        RETRIEVAL_TIMEOUT_MS
      )
    );

    return await Promise.race([retrievalPromise, timeoutPromise]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // R-3: Specifically warn when the vector index hasn't been created yet
    if (msg.includes("index") || msg.includes("vectorSearch")) {
      console.warn(
        `[WUP RAG] Vector index '${VECTOR_INDEX_NAME}' may not exist. ` +
        `Create it in MongoDB Atlas. RAG disabled for this query.`
      );
    } else {
      console.warn(`[WUP Brain] RAG retrieval skipped (${msg})`);
    }
    return []; // Graceful degradation — LLM proceeds without context
  }
}

/**
 * Builds the RAG context string injected into the Gemini system instruction.
 * Enforces the context budget (L-1) to avoid filling the entire context window.
 */
export function buildRagContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";

  let context =
    "\n\n---\nKNOWLEDGE CONTEXT (sourced from your indexed documents — treat as ground truth):\n";
  let budgetRemaining = MAX_RAG_CONTEXT_CHARS;

  for (const [i, chunk] of chunks.entries()) {
    const header = `\n[${i + 1}] Source: "${chunk.metadata.sourceFile}" (p.${chunk.metadata.pageNumber}, relevance: ${(chunk.score * 100).toFixed(0)}%)\n`;
    const body = chunk.text;
    const entry = header + body + "\n";

    if (entry.length > budgetRemaining) {
      // L-1: Truncate this chunk to fit the remaining budget
      const truncated = entry.slice(0, budgetRemaining - 20) + "...[truncated]";
      context += truncated;
      break;
    }

    context += entry;
    budgetRemaining -= entry.length;
  }

  context += "\n---\n";
  return context;
}

export const ragService = new RAGService();
