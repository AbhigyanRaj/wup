import { promisify } from "util";
import zlib from "zlib";
import mongoose from "mongoose";
import { parsePdf, type ParsedDocument } from "./parsers/pdf";
import { parseText } from "./parsers/text";
import { parseCsv } from "./parsers/csv";
import { parseDocx } from "./parsers/docx";
import { chunkCsv, chunkText, cleanText } from "./chunker";
import { embedBatch, EMBED_BATCH_SIZE, isAbortError, isEmbeddingQuotaError } from "./embedder";
import type { KnowledgeFileType } from "./types";

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// ─── Config (read at call time so tests and env changes apply) ───────────────

function intEnv(name: string, fallback: number): number {
  const v = parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export function ingestConcurrency(): number {
  return intEnv("INGEST_CONCURRENCY", 2);
}
export function maxChunksPerFile(): number {
  return intEnv("MAX_CHUNKS_PER_FILE", 500);
}
export function maxChunksPerUser(): number {
  return intEnv("MAX_CHUNKS_PER_USER", 5000);
}

const MIN_TEXT_LENGTH = 5;
/** Keep stored text well under MongoDB's 16MB document limit. */
const MAX_STORED_GZ_BYTES = 12 * 1024 * 1024;

export const RESTART_MESSAGE = "Server restarted. Click Retry";
const RESTART_NO_TEXT_MESSAGE = "Server restarted before the file was read. Please upload it again.";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface IngestJob {
  userId: string;
  sourceId: string;
  /** Raw upload bytes. Either buffer or text is required. */
  buffer?: Buffer;
  /** Already extracted text (retry from KnowledgeSourceText, templates). */
  text?: string;
  fileName: string;
  type: KnowledgeFileType;
  /** Gemini key for embeddings; defaults to the server key. */
  apiKey?: string;
}

export type IngestOutcome = "indexed" | "error" | "error_quota" | "deleted" | "skipped";

/** Known, user-displayable ingestion failure. */
export class IngestorError extends Error {
  constructor(
    public readonly code: string,
    public readonly userMessage: string,
    /** false when retrying from the stored text cannot help */
    public readonly retryable = true
  ) {
    super(userMessage);
    this.name = "IngestorError";
  }
}

// ─── Models (resolved by name; the host process registers them) ──────────────

const KS = () => mongoose.model("KnowledgeSource");
const KC = () => mongoose.model("KnowledgeChunk");
const KST = () => mongoose.model("KnowledgeSourceText");
const oid = (id: string) => new mongoose.Types.ObjectId(id);

// ─── Queue ───────────────────────────────────────────────────────────────────

interface QueueEntry {
  job: IngestJob;
  controller: AbortController;
  resolve: (outcome: IngestOutcome) => void;
}

const waiting: QueueEntry[] = [];
const running = new Map<string, QueueEntry>();
let idleWaiters: Array<() => void> = [];

/** Source ids queued or running in this process. */
export function activeIngestIds(): string[] {
  return [...waiting.map((e) => e.job.sourceId), ...running.keys()];
}

export function isIngestActive(sourceId: string): boolean {
  return running.has(sourceId) || waiting.some((e) => e.job.sourceId === sourceId);
}

/**
 * Adds a job to the in-process FIFO. At most INGEST_CONCURRENCY jobs run at
 * once. The returned promise resolves when the job finishes and never rejects;
 * callers normally ignore it (the HTTP response is already sent).
 * A source that is already queued or running is not queued twice.
 */
export function enqueueIngest(job: IngestJob): Promise<IngestOutcome> {
  if (isIngestActive(job.sourceId)) return Promise.resolve("skipped");
  return new Promise<IngestOutcome>((resolve) => {
    waiting.push({ job, controller: new AbortController(), resolve });
    pump();
  });
}

/**
 * Aborts a queued or running job (called when its source is deleted). The
 * running job stops at its next await and removes any chunks it wrote.
 */
export function cancelIngest(sourceId: string): boolean {
  const idx = waiting.findIndex((e) => e.job.sourceId === sourceId);
  if (idx >= 0) {
    const [entry] = waiting.splice(idx, 1);
    entry.resolve("deleted");
    notifyIdle();
    return true;
  }
  const entry = running.get(sourceId);
  if (entry) {
    entry.controller.abort();
    return true;
  }
  return false;
}

/** Resolves when nothing is queued or running. Mainly for tests and shutdown. */
export function waitForIngestIdle(): Promise<void> {
  if (waiting.length === 0 && running.size === 0) return Promise.resolve();
  return new Promise((r) => idleWaiters.push(r));
}

function notifyIdle() {
  if (waiting.length === 0 && running.size === 0) {
    const w = idleWaiters;
    idleWaiters = [];
    w.forEach((fn) => fn());
  }
}

function pump() {
  while (running.size < ingestConcurrency() && waiting.length > 0) {
    const entry = waiting.shift()!;
    running.set(entry.job.sourceId, entry);
    runIngest(entry.job, entry.controller.signal)
      .catch((err) => {
        console.error(`[Ingestor] Unexpected escape for sourceId=${entry.job.sourceId}:`, err);
        return "error" as IngestOutcome;
      })
      .then((outcome) => {
        running.delete(entry.job.sourceId);
        entry.resolve(outcome);
        pump();
        notifyIdle();
      });
  }
}

// ─── Pipeline ────────────────────────────────────────────────────────────────

async function parseJob(job: IngestJob): Promise<ParsedDocument> {
  if (typeof job.text === "string") return { text: job.text, pageCount: 1, info: {} };
  if (!job.buffer) throw new IngestorError("NO_INPUT", "No file content to index.", false);
  switch (job.type) {
    case "pdf":
      return parsePdf(job.buffer);
    case "docx":
      return parseDocx(job.buffer);
    case "csv":
      return parseCsv(job.buffer);
    default:
      return parseText(job.buffer);
  }
}

/** Light cleanup for CSV (cleanText would rewrite quoted values). */
function cleanCsvText(raw: string): string {
  return raw.replace(/\x00/g, "").replace(/\r\n?/g, "\n").trim();
}

export function cleanForType(type: KnowledgeFileType, raw: string): string {
  return type === "csv" ? cleanCsvText(raw) : cleanText(raw);
}

export function chunkForType(type: KnowledgeFileType, cleaned: string): string[] {
  return type === "csv" ? chunkCsv(cleaned) : chunkText(cleaned);
}

/** Stores the cleaned text gzipped so the source can be retried. Returns true when stored. */
async function storeText(userId: string, sourceId: string, text: string): Promise<boolean> {
  const gz = await gzip(Buffer.from(text, "utf8"));
  if (gz.length > MAX_STORED_GZ_BYTES) return false;
  await KST().updateOne(
    { sourceId: oid(sourceId) },
    { $set: { userId: oid(userId), gz, chars: text.length } },
    { upsert: true }
  );
  return true;
}

/** Reads back the stored text of a source, or null. */
export async function loadStoredText(sourceId: string): Promise<string | null> {
  const row: any = await KST().findOne({ sourceId: oid(sourceId) }).lean();
  if (!row?.gz) return null;
  const buf: Buffer = Buffer.isBuffer(row.gz) ? row.gz : Buffer.from(row.gz.buffer ?? row.gz);
  return (await gunzip(buf)).toString("utf8");
}

class SourceDeleted extends Error {
  constructor() {
    super("source deleted");
    this.name = "SourceDeleted";
  }
}

async function runIngest(job: IngestJob, signal: AbortSignal): Promise<IngestOutcome> {
  const { userId, sourceId, fileName, type } = job;
  const Source = KS();
  const Chunk = KC();
  const started = Date.now();
  let inserted = 0;
  let textStored = false;

  const removeChunks = () => Chunk.deleteMany({ sourceId: oid(sourceId) });
  const ensureAlive = async () => {
    if (signal.aborted || !(await Source.exists({ _id: sourceId }))) throw new SourceDeleted();
  };

  try {
    const start = await Source.findOneAndUpdate(
      { _id: sourceId },
      {
        $set: { status: "pending", chunksDone: 0, chunksTotal: 0, canRetry: false, "metadata.indexingStartedAt": new Date() },
        $unset: { "metadata.errorMessage": "", "metadata.failedAtChunkIndex": "" },
        $inc: { attempts: 1 },
      },
      { new: true }
    );
    if (!start) return "deleted";
    console.log(`[Ingestor] Starting: sourceId=${sourceId} type=${type} file="${fileName}"`);

    // 1. Parse (pdf-parse is CPU heavy but stays inline; concurrency bounds it)
    const parsed = await parseJob(job);
    await ensureAlive();

    // 2. Clean
    const cleaned = cleanForType(type, parsed.text);
    if (cleaned.length < MIN_TEXT_LENGTH) {
      throw type === "pdf"
        ? new IngestorError(
            "PDF_NO_TEXT",
            "PDF has no extractable text. It may be password-protected or image-only (scanned).",
            false
          )
        : new IngestorError("EMPTY_TEXT", "The file has no readable text.", false);
    }

    // 3. Store the text for retries (skip when it came from the store already)
    textStored = typeof job.text === "string" ? true : await storeText(userId, sourceId, cleaned);

    // 4. Chunk, enforcing the per-file cap and the room left under the per-user cap
    const allChunks = chunkForType(type, cleaned);
    if (allChunks.length === 0) throw new IngestorError("EMPTY_TEXT", "The file has no readable text.", false);
    await removeChunks(); // a retry starts from a clean slate
    const otherChunks = await Chunk.countDocuments({ userId: oid(userId) });
    const room = Math.max(0, maxChunksPerUser() - otherChunks);
    if (room === 0) {
      throw new IngestorError(
        "CHUNK_CAP",
        `Chunk limit of ${maxChunksPerUser()} reached. Remove some documents to free up space, then click Retry.`
      );
    }
    const cap = Math.min(maxChunksPerFile(), room);
    const chunks = allChunks.slice(0, cap);
    const truncated = allChunks.length > cap || parsed.truncated === true;
    if (truncated) {
      console.warn(`[Ingestor] sourceId=${sourceId}: ${allChunks.length} chunks, keeping ${chunks.length}.`);
    }

    const indexing = await Source.findOneAndUpdate(
      { _id: sourceId },
      { $set: { status: "indexing", chunksTotal: chunks.length, chunksDone: 0, "metadata.truncated": truncated } },
      { new: true }
    );
    if (!indexing || signal.aborted) throw new SourceDeleted();

    // 5. Embed + persist per batch, with a heartbeat and a deletion check
    for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
      const slice = chunks.slice(i, i + EMBED_BATCH_SIZE);
      const vectors = await embedBatch(slice, { apiKey: job.apiKey, signal });
      await Chunk.insertMany(
        slice.map((text, k) => ({
          userId: oid(userId),
          sourceId: oid(sourceId),
          text,
          embedding: vectors[k],
          metadata: { pageNumber: 0, chunkIndex: i + k, totalChunks: chunks.length, sourceFile: fileName },
        })),
        { ordered: true }
      );
      inserted += slice.length;
      // $inc also refreshes updatedAt: the watchdog's heartbeat
      await Source.updateOne({ _id: sourceId }, { $inc: { chunksDone: slice.length } });
      // Deleted mid-ingest? Remove what we wrote and stop: no orphans.
      await ensureAlive();
    }

    // 6. Done
    const done = await Source.findOneAndUpdate(
      { _id: sourceId },
      {
        $set: { status: "indexed", chunkCount: inserted, chunksDone: inserted, chunksTotal: inserted, canRetry: false, "metadata.truncated": truncated },
        $unset: { "metadata.errorMessage": "", "metadata.failedAtChunkIndex": "" },
      },
      { new: true }
    );
    if (!done) throw new SourceDeleted();
    console.log(
      `[Ingestor] SUCCESS: sourceId=${sourceId} chunks=${inserted} duration=${Date.now() - started}ms truncated=${truncated}`
    );
    return "indexed";
  } catch (err: unknown) {
    // 7. Roll back partial chunks
    await removeChunks().catch((e) => console.error(`[Ingestor] Rollback failed for ${sourceId}:`, e));

    if (err instanceof SourceDeleted || (signal.aborted && isAbortError(err))) {
      // The stored text may have been upserted after the delete handler ran.
      if (!(await Source.exists({ _id: sourceId }).catch(() => true))) {
        await KST().deleteMany({ sourceId: oid(sourceId) }).catch(() => undefined);
      }
      console.log(`[Ingestor] sourceId=${sourceId} was deleted during ingestion; chunks removed.`);
      return "deleted";
    }

    let status: "error" | "error_quota" = "error";
    let errorMessage = "An unexpected error occurred during indexing. Click Retry to try again.";
    let retryable = true;
    if (err instanceof IngestorError) {
      errorMessage = err.userMessage;
      retryable = err.retryable;
    } else if (isEmbeddingQuotaError(err)) {
      status = "error_quota";
      errorMessage = "Embedding quota reached for today. Click Retry tomorrow, or add your own Gemini key.";
    } else if ((err as any)?.status === 429) {
      errorMessage = "The embedding service is busy. Click Retry in a few minutes.";
    } else if (!textStored) {
      errorMessage = "Could not read this file. It may be damaged or in an unsupported format.";
    }
    console.error(`[Ingestor] FAILED: sourceId=${sourceId} after ${inserted} chunks:`, err);

    // canRetry only when the text is stored and a retry could succeed
    const hasText = textStored || !!(await KST().exists({ sourceId: oid(sourceId) }).catch(() => null));
    await Source.updateOne(
      { _id: sourceId },
      {
        $set: {
          status,
          canRetry: retryable && hasText,
          chunksDone: 0,
          "metadata.errorMessage": errorMessage,
          "metadata.failedAtChunkIndex": inserted,
        },
      }
    ).catch((e) => console.error(`[Ingestor] Could not record failure for ${sourceId}:`, e));
    return status;
  }
}

// ─── Retry and recovery ──────────────────────────────────────────────────────

export type RetryResult =
  | { ok: true; source: any }
  | { ok: false; reason: "not_found" | "busy" | "no_text" | "not_retryable" };

/**
 * Re-queues a failed source from its stored text. The source is reset to
 * "pending" first so pollers see it move immediately.
 */
export async function retryIngest(sourceId: string, userId: string, options: { apiKey?: string } = {}): Promise<RetryResult> {
  if (!mongoose.isValidObjectId(sourceId)) return { ok: false, reason: "not_found" };
  const Source = KS();
  const source: any = await Source.findOne({ _id: sourceId, userId: oid(userId) }).lean();
  if (!source) return { ok: false, reason: "not_found" };
  if (isIngestActive(sourceId) || source.status === "pending" || source.status === "indexing") {
    return { ok: false, reason: "busy" };
  }
  if (source.status === "indexed") return { ok: false, reason: "not_retryable" };
  const text = await loadStoredText(sourceId);
  if (text === null) return { ok: false, reason: "no_text" };

  const updated = await Source.findOneAndUpdate(
    { _id: sourceId, userId: oid(userId), status: { $in: ["error", "error_quota"] } },
    {
      $set: { status: "pending", chunksDone: 0, chunksTotal: 0, canRetry: false },
      $unset: { "metadata.errorMessage": "", "metadata.failedAtChunkIndex": "" },
    },
    { new: true }
  ).lean();
  if (!updated) return { ok: false, reason: "busy" };

  void enqueueIngest({
    userId,
    sourceId,
    text,
    fileName: source.name,
    type: (source.type === "url" ? "txt" : source.type) as KnowledgeFileType,
    apiKey: options.apiKey,
  });
  return { ok: true, source: updated };
}

/**
 * Boot-time recovery: any source left "pending" or "indexing" by a previous
 * process can never finish. Mark it failed (retryable when its text was
 * stored) and remove its partial chunks. Sources queued in this process are
 * left alone. Returns the number of sources recovered.
 */
export async function recoverInterruptedIngests(): Promise<number> {
  const Source = KS();
  const stuck: any[] = await Source.find(
    { status: { $in: ["pending", "indexing"] }, _id: { $nin: activeIngestIds().map(oid) } },
    { _id: 1 }
  ).lean();
  if (stuck.length === 0) return 0;
  const ids = stuck.map((s) => s._id);
  const withText: any[] = await KST().find({ sourceId: { $in: ids } }, { sourceId: 1 }).lean();
  const textIds = new Set(withText.map((t) => String(t.sourceId)));
  const retryIds = ids.filter((id) => textIds.has(String(id)));
  const noTextIds = ids.filter((id) => !textIds.has(String(id)));
  const stuckFilter = { status: { $in: ["pending", "indexing"] } };

  if (retryIds.length > 0) {
    await Source.updateMany(
      { _id: { $in: retryIds }, ...stuckFilter },
      { $set: { status: "error", canRetry: true, chunksDone: 0, "metadata.errorMessage": RESTART_MESSAGE } }
    );
  }
  if (noTextIds.length > 0) {
    await Source.updateMany(
      { _id: { $in: noTextIds }, ...stuckFilter },
      { $set: { status: "error", canRetry: false, chunksDone: 0, "metadata.errorMessage": RESTART_NO_TEXT_MESSAGE } }
    );
  }
  await KC().deleteMany({ sourceId: { $in: ids } });
  console.warn(`[Ingestor] Recovered ${ids.length} interrupted ingestion(s) after restart.`);
  return ids.length;
}
