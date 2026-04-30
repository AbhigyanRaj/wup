import mongoose from "mongoose";
import { parsePdf, parseTxt } from "./parsers/pdf";
import { chunkText, cleanText } from "./chunker";
import { embedWithRetry } from "./embedder";

// ─── Config ──────────────────────────────────────────────────────────────────

const MAX_CHUNKS_PER_FILE = parseInt(
  process.env.MAX_CHUNKS_PER_FILE ?? "500",
  10
);
const MIN_TEXT_LENGTH = 5; // I-2, I-3: allow very short test strings

// ─── Types ───────────────────────────────────────────────────────────────────

export type SupportedMimeType =
  | "application/pdf"
  | "text/plain";

export interface IngestResult {
  chunkCount: number;
  truncated: boolean;
  pageCount: number;
}

// ─── Mongoose Models (resolved at runtime via the API process) ────────────────
// We import the model names as strings and resolve them at call time so this
// package doesn't need to duplicate schema definitions.

function getKnowledgeSource() {
  return mongoose.model("KnowledgeSource");
}

function getKnowledgeChunk() {
  return mongoose.model("KnowledgeChunk");
}

// ─── Core Ingestor ───────────────────────────────────────────────────────────

export class IngestorService {
  /**
   * Full ingestion pipeline:
   *   parse → clean → chunk → embed (with retry) → persist
   *
   * This is the ATOMIC ROLLBACK pattern from the architecture plan (I-7):
   * if anything fails after chunk insertion has started, all partial
   * chunks are deleted and the source status is set to "error".
   *
   * @param userId       Owner of this document
   * @param sourceId     The KnowledgeSource _id (already created by the controller)
   * @param buffer       Raw file bytes from multer
   * @param mimeType     e.g. "application/pdf" | "text/plain"
   * @param fileName     Display name for chunk metadata
   */
  async ingest(
    userId: string,
    sourceId: string,
    buffer: Buffer,
    mimeType: SupportedMimeType,
    fileName: string
  ): Promise<void> {
    const KnowledgeSource = getKnowledgeSource();
    const KnowledgeChunk = getKnowledgeChunk();

    let insertedCount = 0;
    const startTime = Date.now();

    try {
      console.log(`[Ingestor] Starting ingestion: sourceId=${sourceId} file="${fileName}"`);

      // Mark as indexing + record start time
      await KnowledgeSource.findByIdAndUpdate(sourceId, {
        status: "indexing",
        "metadata.indexingStartedAt": new Date(),
      });

      // ── Step 1: Parse ──────────────────────────────────────────────────────
      let parsed;
      if (mimeType === "application/pdf") {
        parsed = await parsePdf(buffer);
      } else {
        parsed = await parseTxt(buffer);
      }

      // I-2, I-3: Detect encrypted or image-only PDFs
      const cleanedText = cleanText(parsed.text);
      if (!cleanedText || cleanedText.length < MIN_TEXT_LENGTH) {
        throw new IngestorError(
          "PDF_NO_TEXT",
          "PDF has no extractable text. It may be password-protected or image-only (scanned). OCR support coming soon."
        );
      }

      // ── Step 2: Chunk ──────────────────────────────────────────────────────
      const allChunks = chunkText(cleanedText);

      // I-9: Enforce chunk cap to prevent OOM on huge files
      const truncated = allChunks.length > MAX_CHUNKS_PER_FILE;
      const safeChunks = allChunks.slice(0, MAX_CHUNKS_PER_FILE);

      if (truncated) {
        console.warn(
          `[Ingestor] sourceId=${sourceId}: ${allChunks.length} chunks exceeds cap of ${MAX_CHUNKS_PER_FILE}. Truncating.`
        );
      }

      console.log(
        `[Ingestor] sourceId=${sourceId}: ${safeChunks.length} chunks generated from ${parsed.pageCount} pages`
      );

      // ── Step 3: Embed + Persist ────────────────────────────────────────────
      for (const [i, chunkText_] of safeChunks.entries()) {
        // I-5, I-6: embedWithRetry handles rate limits + quota errors
        const embedding = await embedWithRetry(chunkText_);

        await KnowledgeChunk.create({
          userId: new mongoose.Types.ObjectId(userId),
          sourceId: new mongoose.Types.ObjectId(sourceId),
          text: chunkText_,
          embedding,
          metadata: {
            pageNumber: 0, // pdf-parse doesn't give us per-chunk page numbers easily
            chunkIndex: i,
            totalChunks: safeChunks.length,
            sourceFile: fileName,
          },
        });

        insertedCount++;

        // Log progress every 20 chunks
        if ((i + 1) % 20 === 0 || i === safeChunks.length - 1) {
          console.log(
            `[Ingestor] sourceId=${sourceId}: ${insertedCount}/${safeChunks.length} chunks indexed`
          );
        }
      }

      // ── Step 4: Mark complete ──────────────────────────────────────────────
      const duration = Date.now() - startTime;
      await KnowledgeSource.findByIdAndUpdate(sourceId, {
        status: "indexed",
        chunkCount: insertedCount,
        "metadata.truncated": truncated,
      });

      console.log(
        `[Ingestor] SUCCESS: sourceId=${sourceId} | chunks=${insertedCount} | duration=${duration}ms | truncated=${truncated}`
      );
    } catch (err: unknown) {
      // ── Atomic Rollback (I-7) ──────────────────────────────────────────────
      console.error(
        `[Ingestor] FAILED: sourceId=${sourceId} at chunk ${insertedCount}. Rolling back...`,
        err
      );

      // Delete all partial chunks
      await KnowledgeChunk.deleteMany({
        sourceId: new mongoose.Types.ObjectId(sourceId),
      });

      // Determine error type for frontend messaging
      let status: "error" | "error_quota" = "error";
      let errorMessage = "An unexpected error occurred during indexing.";

      if (err instanceof IngestorError) {
        errorMessage = err.userMessage;
      } else if (
        JSON.stringify(err).includes("PerDay") ||
        JSON.stringify(err).includes("RESOURCE_EXHAUSTED")
      ) {
        status = "error_quota";
        errorMessage =
          "Embedding quota reached for today. Indexing will be available again tomorrow.";
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      await KnowledgeSource.findByIdAndUpdate(sourceId, {
        status,
        "metadata.errorMessage": errorMessage,
        "metadata.failedAtChunkIndex": insertedCount,
      });

      // Do NOT re-throw — this runs in a background async context.
      // The controller already returned 202 to the client.
    }
  }
}

/**
 * Custom error class for known, user-displayable ingestion failures.
 */
class IngestorError extends Error {
  constructor(
    public readonly code: string,
    public readonly userMessage: string
  ) {
    super(userMessage);
    this.name = "IngestorError";
  }
}

export const ingestorService = new IngestorService();
