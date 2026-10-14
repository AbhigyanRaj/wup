import { enqueueIngest, IngestorError, type IngestOutcome } from "./queue";
import type { KnowledgeFileType } from "./types";

// ─── Types ───────────────────────────────────────────────────────────────────

export type SupportedMimeType =
  | "application/pdf"
  | "text/plain"
  | "text/markdown"
  | "text/csv"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export interface IngestResult {
  chunkCount: number;
  truncated: boolean;
  pageCount: number;
}

const TYPE_BY_MIME: Record<string, KnowledgeFileType> = {
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/csv": "csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

// ─── Compat service ──────────────────────────────────────────────────────────

/**
 * Backward-compatible facade. ingest() now enqueues the job on the in-process
 * ingest queue (see queue.ts) and resolves when it finishes. It never throws:
 * failures are recorded on the KnowledgeSource.
 */
export class IngestorService {
  async ingest(
    userId: string,
    sourceId: string,
    buffer: Buffer,
    mimeType: SupportedMimeType | string,
    fileName: string
  ): Promise<IngestOutcome> {
    return enqueueIngest({
      userId,
      sourceId,
      buffer,
      fileName,
      type: TYPE_BY_MIME[mimeType] ?? "txt",
    });
  }
}

export { IngestorError };

export const ingestorService = new IngestorService();
