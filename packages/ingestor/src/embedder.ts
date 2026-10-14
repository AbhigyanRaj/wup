import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Gemini embeddings for ingestion (batched) and retrieval (single query).
 *
 * The model, dimensionality and the absence of `taskType` must stay exactly as
 * they are: every vector already stored in KnowledgeChunk was produced with
 * this configuration, and changing any of it would silently break retrieval
 * against existing documents.
 */
export const EMBEDDING_MODEL = "gemini-embedding-2";
export const EMBEDDING_DIMENSIONS = 768;

/** Texts per batchEmbedContents call. */
export const EMBED_BATCH_SIZE = 50;

/** Default backoff schedule (ms) for 429 / 5xx / network errors. */
const DEFAULT_BACKOFF_MS = [1000, 2000, 4000, 8000, 16000];
/** Per-request timeout for an embedding call. */
const EMBED_CALL_TIMEOUT_MS = 60_000;
/** Upper bound for a server-provided retryDelay. */
const MAX_RETRY_DELAY_MS = 60_000;

// ─── Client ──────────────────────────────────────────────────────────────────

export interface EmbedCallOptions {
  /** Gemini API key; defaults to the server's GEMINI_API_KEY. */
  apiKey?: string;
  signal?: AbortSignal;
}

/**
 * One embedding round trip. Implementations embed every text in a single
 * request (at most EMBED_BATCH_SIZE texts) and return vectors in input order.
 * Injectable so tests never hit the network.
 */
export interface EmbeddingClient {
  embedTexts(texts: string[], options: EmbedCallOptions): Promise<number[][]>;
}

function resolveApiKey(apiKey?: string): string {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("[Ingestor] GEMINI_API_KEY is not set. Cannot generate embeddings.");
  }
  return key;
}

const genAIByKey = new Map<string, GoogleGenerativeAI>();
function getGenAI(key: string): GoogleGenerativeAI {
  let g = genAIByKey.get(key);
  if (!g) {
    g = new GoogleGenerativeAI(key);
    // Bound the cache: user keys come and go.
    if (genAIByKey.size > 100) genAIByKey.clear();
    genAIByKey.set(key, g);
  }
  return g;
}

/**
 * Gemini client. Uses model.batchEmbedContents (SDK 0.21); each request object
 * is forwarded verbatim in the JSON body, so `outputDimensionality` reaches the
 * API. `taskType` is deliberately not set.
 */
export class GeminiEmbeddingClient implements EmbeddingClient {
  async embedTexts(texts: string[], options: EmbedCallOptions): Promise<number[][]> {
    const model = getGenAI(resolveApiKey(options.apiKey)).getGenerativeModel(
      { model: EMBEDDING_MODEL },
      { apiVersion: "v1beta" }
    );
    // A hard per-call timeout so a hung request cannot stall an ingest forever.
    const requestOptions = { timeout: EMBED_CALL_TIMEOUT_MS, ...(options.signal ? { signal: options.signal } : {}) };
    if (texts.length === 1) {
      // Single query (retrieval): embedContent, identical to the vectors
      // produced before batching was introduced.
      const res = await model.embedContent(
        {
          content: { role: "user", parts: [{ text: texts[0] }] },
          outputDimensionality: EMBEDDING_DIMENSIONS,
        } as any,
        requestOptions
      );
      return [res.embedding.values];
    }
    const res = await model.batchEmbedContents(
      {
        requests: texts.map(
          (text) =>
            ({
              content: { role: "user", parts: [{ text }] },
              outputDimensionality: EMBEDDING_DIMENSIONS,
            }) as any
        ),
      },
      requestOptions
    );
    return (res.embeddings ?? []).map((e) => e.values);
  }
}

// ─── Configuration (tests) ───────────────────────────────────────────────────

let client: EmbeddingClient = new GeminiEmbeddingClient();
let backoffMs: number[] = DEFAULT_BACKOFF_MS;

/**
 * Swaps the embedding client and/or backoff schedule. Returns a function that
 * restores the previous configuration. Intended for tests.
 */
export function configureEmbedder(config: { client?: EmbeddingClient; backoffMs?: number[] }): () => void {
  const prev = { client, backoffMs };
  if (config.client) client = config.client;
  if (config.backoffMs) backoffMs = config.backoffMs;
  return () => {
    client = prev.client;
    backoffMs = prev.backoffMs;
  };
}

export function getEmbeddingClient(): EmbeddingClient {
  return client;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

/** Daily embedding quota exhausted. Not retried; ingestion ends as "error_quota". */
export class EmbeddingQuotaError extends Error {
  readonly code = "error_quota" as const;
  constructor(message = "Embedding quota reached for today.", readonly cause?: unknown) {
    super(message);
    this.name = "EmbeddingQuotaError";
  }
}

export function isEmbeddingQuotaError(err: unknown): err is EmbeddingQuotaError {
  return err instanceof EmbeddingQuotaError || (err as any)?.code === "error_quota";
}

function abortError(signal?: AbortSignal): Error {
  const reason = signal?.reason;
  if (reason instanceof Error) return reason;
  const e = new Error("Embedding aborted");
  e.name = "AbortError";
  return e;
}

export function isAbortError(err: unknown): boolean {
  return (err as any)?.name === "AbortError";
}

function errorText(err: unknown): string {
  const parts: string[] = [];
  if (err instanceof Error) parts.push(err.message);
  try {
    const details = (err as any)?.errorDetails;
    if (details) parts.push(JSON.stringify(details));
  } catch {
    /* ignore */
  }
  if (parts.length === 0) {
    try {
      parts.push(JSON.stringify(err));
    } catch {
      parts.push(String(err));
    }
  }
  return parts.join(" ");
}

function statusOf(err: unknown): number | undefined {
  const s = Number((err as any)?.status ?? (err as any)?.statusCode);
  if (Number.isFinite(s) && s > 0) return s;
  const m = /\[(\d{3})[ \]]/.exec(errorText(err));
  return m ? Number(m[1]) : undefined;
}

/** A PerDay quota violation: retrying today will not help. */
export function isDailyQuotaError(err: unknown): boolean {
  return /PerDay/i.test(errorText(err));
}

function isRetryable(err: unknown): boolean {
  const status = statusOf(err);
  if (status === 429 || (status !== undefined && status >= 500)) return true;
  if (status !== undefined) return false;
  // Network-level failures carry no status.
  return /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|aborted|timed? ?out|RATE_LIMIT/i.test(errorText(err));
}

/** Server-suggested delay from a google.rpc.RetryInfo detail ("17s", "1.5s"). */
export function retryDelayMs(err: unknown): number | undefined {
  const details: any[] = Array.isArray((err as any)?.errorDetails) ? (err as any).errorDetails : [];
  for (const d of details) {
    const raw = d?.retryDelay;
    if (typeof raw === "string") {
      const m = /^([\d.]+)s$/.exec(raw.trim());
      if (m) return Math.min(MAX_RETRY_DELAY_MS, Math.round(parseFloat(m[1]) * 1000));
    }
  }
  const m = /retry in ([\d.]+)s/i.exec(errorText(err));
  return m ? Math.min(MAX_RETRY_DELAY_MS, Math.round(parseFloat(m[1]) * 1000)) : undefined;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError(signal));
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError(signal));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Runs one embedding call with backoff: 1, 2, 4, 8, 16s (each with +-25%
 * jitter, and never less than the server's retryDelay) on 429 / 5xx / network
 * errors. A PerDay quota error fails fast as EmbeddingQuotaError. Aborts are
 * honoured immediately, including during a backoff wait.
 */
async function callWithRetry(texts: string[], options: EmbedCallOptions): Promise<number[][]> {
  const { signal } = options;
  for (let attempt = 0; ; attempt++) {
    if (signal?.aborted) throw abortError(signal);
    try {
      const vectors = await client.embedTexts(texts, options);
      if (vectors.length !== texts.length) {
        throw new Error(`[Ingestor] Expected ${texts.length} embeddings, got ${vectors.length}`);
      }
      for (const v of vectors) {
        if (!Array.isArray(v) || v.length !== EMBEDDING_DIMENSIONS) {
          throw new Error(
            `[Ingestor] Expected ${EMBEDDING_DIMENSIONS}-dim embedding, got ${Array.isArray(v) ? v.length : 0}`
          );
        }
      }
      return vectors;
    } catch (err) {
      if (signal?.aborted || isAbortError(err)) throw signal?.aborted ? abortError(signal) : err;
      if (isDailyQuotaError(err)) {
        console.error("[Ingestor] Daily embedding quota exhausted. Failing fast.");
        throw new EmbeddingQuotaError(undefined, err);
      }
      if (!isRetryable(err) || attempt >= backoffMs.length) throw err;
      const base = backoffMs[attempt];
      const jittered = Math.round(base * (0.75 + Math.random() * 0.5));
      const delay = Math.max(jittered, retryDelayMs(err) ?? 0);
      console.warn(
        `[Ingestor] Embedding call failed (status ${statusOf(err) ?? "n/a"}), retry ${attempt + 1}/${backoffMs.length} in ${delay}ms`
      );
      await sleep(delay, signal);
    }
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface EmbedBatchOptions extends EmbedCallOptions {
  /** Called after every batch with (embedded so far, total). */
  onProgress?: (completed: number, total: number) => void;
}

/**
 * Embeds many texts using batchEmbedContents, EMBED_BATCH_SIZE texts per call,
 * with retry/backoff per call. Vectors are returned in input order.
 *
 * The legacy signature embedBatch(texts, onProgress) is still accepted.
 */
export async function embedBatch(
  texts: string[],
  options: EmbedBatchOptions | ((completed: number, total: number) => void) = {}
): Promise<number[][]> {
  const opts: EmbedBatchOptions = typeof options === "function" ? { onProgress: options } : options;
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const slice = texts.slice(i, i + EMBED_BATCH_SIZE);
    const vectors = await callWithRetry(slice, opts);
    results.push(...vectors);
    opts.onProgress?.(results.length, texts.length);
  }
  return results;
}

/** Embeds a single text (retrieval queries). Same model and settings as ingestion. */
export async function embed(text: string, options: EmbedCallOptions = {}): Promise<number[]> {
  const [vector] = await callWithRetry([text], options);
  return vector;
}

/** @deprecated use embed(); kept for older callers. */
export async function embedWithRetry(text: string, _maxRetries?: number): Promise<number[]> {
  return embed(text);
}
