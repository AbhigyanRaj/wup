import mongoose from "mongoose";
import { embed as defaultEmbed } from "@wup/ingestor";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RetrievedChunk {
  sourceId: string;
  sourceFile: string;
  pageNumber: number;
  chunkIndex: number;
  text: string;
  /** Cosine similarity in [-1, 1] (converted from Atlas vectorSearchScore). */
  score: number;
  /** @deprecated legacy shape; same values as the top-level fields. */
  metadata: {
    sourceFile: string;
    pageNumber: number;
    chunkIndex: number;
    sourceId: string;
  };
}

export interface RetrieveOptions {
  signal?: AbortSignal;
  /** The user's own Gemini key, when they have one. Defaults to the server key. */
  apiKey?: string;
}

export type AggregateFn = (pipeline: any[], options: { maxTimeMS: number }) => Promise<any[]>;
export type QueryEmbedFn = (query: string, options: RetrieveOptions) => Promise<number[]>;

// ─── Config ───────────────────────────────────────────────────────────────────

/** MongoDB Atlas Vector Search index name, created in the Atlas UI */
const VECTOR_INDEX_NAME = "knowledge_vector_index";

/** Hard timeout for the entire retrieval operation in ms (R-8) */
const RETRIEVAL_TIMEOUT_MS = 5000;

/** Max characters to use from the query for embedding (R-7) */
const MAX_QUERY_CHARS = 2000;

/** Results further than this below the best cosine are dropped. */
const RELATIVE_WINDOW = 0.15;

/** Max total characters of RAG context injected into the prompt (L-1) */
export const MAX_RAG_CONTEXT_CHARS = 8000;

/** A chunk is skipped when less than this much budget remains. */
const MIN_ENTRY_BUDGET = 200;

function numEnv(name: string, fallback: number): number {
  const v = parseFloat(process.env[name] ?? "");
  return Number.isFinite(v) ? v : fallback;
}

/** Minimum cosine similarity (RAG_MIN_COSINE, default 0.5). */
export function ragMinCosine(): number {
  return numEnv("RAG_MIN_COSINE", 0.5);
}

/** Max chunks returned (RAG_TOP_K, default 6). */
export function ragTopK(): number {
  return Math.max(1, Math.floor(numEnv("RAG_TOP_K", 6)));
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Atlas reports cosine similarity as vectorSearchScore = (1 + cos) / 2,
 * so cos = 2 * score - 1.
 */
export function vectorScoreToCosine(score: number): number {
  return 2 * score - 1;
}

/**
 * Keeps results with cosine >= minCosine that are within `window` of the best
 * result, best first, at most topK.
 */
export function selectRelevant<T extends { score: number }>(
  results: T[],
  opts: { minCosine?: number; window?: number; topK?: number } = {}
): T[] {
  const minCosine = opts.minCosine ?? ragMinCosine();
  const window = opts.window ?? RELATIVE_WINDOW;
  const topK = opts.topK ?? ragTopK();
  const valid = results
    .filter((r) => typeof r.score === "number" && Number.isFinite(r.score) && r.score >= minCosine)
    .sort((a, b) => b.score - a.score);
  if (valid.length === 0) return [];
  const best = valid[0].score;
  return valid.filter((r) => r.score >= best - window).slice(0, topK);
}

// ─── RAG Service ─────────────────────────────────────────────────────────────

export class RAGService {
  private readonly aggregate: AggregateFn;
  private readonly embedQuery: QueryEmbedFn;

  constructor(deps: { aggregate?: AggregateFn; embed?: QueryEmbedFn } = {}) {
    this.aggregate =
      deps.aggregate ??
      ((pipeline, options) =>
        mongoose.model("KnowledgeChunk").aggregate(pipeline).option({ maxTimeMS: options.maxTimeMS }).exec());
    this.embedQuery = deps.embed ?? ((q, o) => defaultEmbed(q, { signal: o.signal, apiKey: o.apiKey }));
  }

  /**
   * Retrieves the most similar chunks of the user's own documents.
   * Security: the $vectorSearch filter always includes userId (S-1).
   */
  async retrieve(userId: string, rawQuery: string, options: RetrieveOptions = {}): Promise<RetrievedChunk[]> {
    const query = (rawQuery ?? "").slice(0, MAX_QUERY_CHARS); // R-7
    if (!query.trim()) return [];
    const topK = ragTopK();

    const queryVector = await this.embedQuery(query, options);
    if (options.signal?.aborted) throw new Error("RAG_TIMEOUT");

    const results = await this.aggregate(
      [
        {
          $vectorSearch: {
            index: VECTOR_INDEX_NAME,
            path: "embedding",
            queryVector,
            numCandidates: Math.max(100, topK * 20),
            limit: topK * 2,
            filter: { userId: new mongoose.Types.ObjectId(userId) }, // S-1
          },
        },
        {
          $project: {
            // S-7: never return raw embeddings
            text: 1,
            "metadata.sourceFile": 1,
            "metadata.pageNumber": 1,
            "metadata.chunkIndex": 1,
            _sourceId: "$sourceId",
            score: { $meta: "vectorSearchScore" },
          },
        },
      ],
      { maxTimeMS: RETRIEVAL_TIMEOUT_MS }
    );

    const mapped: RetrievedChunk[] = (results ?? [])
      .filter((r: any) => typeof r?.score === "number" && typeof r?.text === "string")
      .map((r: any) => {
        const sourceFile = r.metadata?.sourceFile ?? "Unknown";
        const pageNumber = r.metadata?.pageNumber ?? 0;
        const chunkIndex = r.metadata?.chunkIndex ?? 0;
        const sourceId = r._sourceId?.toString() ?? "";
        return {
          sourceId,
          sourceFile,
          pageNumber,
          chunkIndex,
          text: r.text as string,
          score: vectorScoreToCosine(r.score as number),
          metadata: { sourceFile, pageNumber, chunkIndex, sourceId },
        };
      });

    return selectRelevant(mapped, { topK }); // R-5
  }
}

export const ragService = new RAGService();

// ─── Helpers exported for the orchestrator ───────────────────────────────────

export interface SafeRetrieveOptions extends RetrieveOptions {
  /** Defaults to the shared ragService. */
  service?: RAGService;
  timeoutMs?: number;
}

/**
 * Non-blocking RAG wrapper: any failure (embed error, Atlas down, timeout,
 * missing index) returns [] and the answer proceeds without document context.
 *
 *   safeRetrieve(userId, query, { signal, apiKey })
 *   safeRetrieve(ragService, userId, query)          // legacy call shape
 */
export function safeRetrieve(userId: string, query: string, options?: SafeRetrieveOptions): Promise<RetrievedChunk[]>;
export function safeRetrieve(
  service: RAGService,
  userId: string,
  query: string,
  options?: SafeRetrieveOptions
): Promise<RetrievedChunk[]>;
export async function safeRetrieve(
  a: string | RAGService,
  b: string,
  c?: string | SafeRetrieveOptions,
  d?: SafeRetrieveOptions
): Promise<RetrievedChunk[]> {
  let service: RAGService;
  let userId: string;
  let query: string;
  let options: SafeRetrieveOptions;
  if (typeof a === "string") {
    userId = a;
    query = b;
    options = (typeof c === "object" && c) || {};
    service = options.service ?? ragService;
  } else {
    service = a;
    userId = b;
    query = typeof c === "string" ? c : "";
    options = d ?? {};
  }

  const controller = new AbortController();
  const onOuterAbort = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) return [];
  options.signal?.addEventListener("abort", onOuterAbort, { once: true });

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const aborted = new Promise<never>((_, reject) => {
      const fail = () => reject(new Error(options.signal?.aborted ? "RAG_ABORTED" : "RAG_TIMEOUT"));
      controller.signal.addEventListener("abort", fail, { once: true });
      timer = setTimeout(() => controller.abort(), options.timeoutMs ?? RETRIEVAL_TIMEOUT_MS); // R-8
    });
    aborted.catch(() => undefined); // never an unhandled rejection
    return await Promise.race([
      service.retrieve(userId, query, { signal: controller.signal, apiKey: options.apiKey }),
      aborted,
    ]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "RAG_ABORTED") return [];
    // R-3: warn specifically when the vector index has not been created
    if (/index|vectorSearch/i.test(msg) && msg !== "RAG_TIMEOUT") {
      console.warn(
        `[WUP RAG] Vector index '${VECTOR_INDEX_NAME}' may not exist. Create it in MongoDB Atlas. RAG disabled for this query.`
      );
    } else {
      console.warn(`[WUP Brain] RAG retrieval skipped (${msg})`);
    }
    return [];
  } finally {
    if (timer) clearTimeout(timer);
    options.signal?.removeEventListener("abort", onOuterAbort);
    if (!controller.signal.aborted) controller.abort(); // stop any in-flight embed call
  }
}

/**
 * Citation number for a chunk: a function (chunk, index) => n, or an array
 * indexed like `chunks`. Missing entries fall back to index + 1.
 */
export type CitationNumbering = ((chunk: RetrievedChunk, index: number) => number | undefined) | readonly number[];

/**
 * Builds the numbered KNOWLEDGE CONTEXT block for the system instruction.
 * Enforces the context budget (L-1): a chunk is skipped once less than 200
 * characters of budget remain, and the last chunk that fits is truncated.
 */
export function buildRagContext(chunks: RetrievedChunk[], numberFor?: CitationNumbering): string {
  if (!chunks || chunks.length === 0) return "";

  const numberOf = (chunk: RetrievedChunk, i: number): number => {
    const n = typeof numberFor === "function" ? numberFor(chunk, i) : numberFor?.[i];
    return typeof n === "number" && Number.isFinite(n) ? n : i + 1;
  };

  let context =
    "\n\n---\nKNOWLEDGE CONTEXT (passages from the user's indexed documents; cite them as [n] when you use them):\n";
  let budget = MAX_RAG_CONTEXT_CHARS;
  const marker = "...[truncated]";

  for (const [i, chunk] of chunks.entries()) {
    if (budget < MIN_ENTRY_BUDGET) break;
    const sourceFile = chunk.sourceFile ?? chunk.metadata?.sourceFile ?? "Unknown";
    const pageNumber = chunk.pageNumber ?? chunk.metadata?.pageNumber ?? 0;
    const relevance = Math.max(0, Math.round((chunk.score ?? 0) * 100));
    const page = pageNumber > 0 ? `, p.${pageNumber}` : "";
    const header = `\n[${numberOf(chunk, i)}] Source: "${sourceFile}"${page} (relevance: ${relevance}%)\n`;
    let entry = header + (chunk.text ?? "") + "\n";

    if (entry.length > budget) {
      const room = budget - marker.length - 1;
      if (room <= header.length) break;
      entry = entry.slice(0, room) + marker + "\n";
    }
    context += entry;
    budget -= entry.length;
  }

  context += "\n---\n";
  return context;
}
