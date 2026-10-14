import crypto from "crypto";
import type { Request, Response } from "express";
import mongoose from "mongoose";
import { KnowledgeChunk, KnowledgeSource, KnowledgeSourceText } from "@wup/models";
import {
  activeIngestIds,
  cancelIngest,
  detectFileType,
  enqueueIngest,
  retryIngest,
  type KnowledgeFileType,
} from "@wup/ingestor";
import { env } from "../config/env";
import { HttpError } from "../lib/httpError";
import { ALLOWED_UPLOAD_EXTENSIONS, MAX_UPLOAD_SIZE_MB, UNSUPPORTED_FILE_MESSAGE } from "../middleware/upload";
import { toKnowledgeConfig, toKnowledgeDTO, toLegacyStatus } from "../dto/knowledge";

/** Indexing with no heartbeat for this long is considered stalled (I-11). */
export const STALE_INDEXING_MS = 5 * 60 * 1000;
/** Pending (never started) for this long is considered lost. */
export const STALE_PENDING_MS = 15 * 60 * 1000;

const ACTIVE_STATUSES = ["pending", "indexing", "indexed"];
const FAILED_STATUSES = ["error", "error_quota"];

const userIdOf = (req: Request): string => req.auth?.userId ?? (req as any).user.id;
const oid = (id: string) => new mongoose.Types.ObjectId(id);

/** Basename without path parts or control characters, at most 200 chars. */
export function sanitizeFileName(name: string): string {
  const base = (name ?? "").split(/[\\/]/).pop() ?? "";
  // eslint-disable-next-line no-control-regex
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (clean || "Untitled").slice(0, 200);
}

async function findOwnedSource(req: Request) {
  const source = await KnowledgeSource.findOne({ _id: req.params.sourceId, userId: userIdOf(req) }).lean();
  if (!source) throw HttpError.notFound("Knowledge source not found.");
  return source;
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export const uploadKnowledge = async (req: Request, res: Response) => {
  const userId = userIdOf(req);
  const file = req.file;

  if (!file) throw HttpError.badRequest("No file uploaded. Send a file with field name 'file'.");
  if (file.size === 0) throw HttpError.badRequest("File is empty."); // I-10

  // The client's mimetype is never trusted: detect from the bytes.
  const detected = detectFileType(file.buffer, file.originalname);
  if (!detected) throw new HttpError(400, "UNSUPPORTED_FILE", UNSUPPORTED_FILE_MESSAGE);

  const name = sanitizeFileName(file.originalname); // S-4
  const fileHash = crypto.createHash("sha256").update(file.buffer).digest("hex"); // I-8

  // Duplicates: only a live or indexed copy blocks the upload.
  const duplicate = await KnowledgeSource.findOne({ userId, fileHash, status: { $in: ACTIVE_STATUSES } }).lean();
  if (duplicate) {
    const dto = toKnowledgeDTO(duplicate);
    res.status(409).json({
      error: duplicate.status === "indexed" ? "This document is already indexed." : "This document is already being indexed.",
      code: "CONFLICT",
      sourceId: dto.id,
      status: dto.status,
      source: dto,
    });
    return;
  }

  // S-8: per-user chunk cap (applies to re-queues too)
  const chunkCount = await KnowledgeChunk.countDocuments({ userId });
  if (chunkCount >= env.MAX_CHUNKS_PER_USER) {
    throw new HttpError(
      429,
      "RATE_LIMITED",
      `Chunk limit of ${env.MAX_CHUNKS_PER_USER} reached. Remove some documents to free up space.`
    );
  }

  // A failed copy of the same file is reset and re-queued with the new bytes.
  let source: any = await KnowledgeSource.findOneAndUpdate(
    { userId, fileHash, status: { $in: FAILED_STATUSES } },
    {
      $set: {
        name,
        type: detected.type,
        mimeType: detected.mime,
        fileSize: file.size,
        status: "pending",
        chunksDone: 0,
        chunksTotal: 0,
        canRetry: false,
      },
      $unset: { "metadata.errorMessage": "", "metadata.failedAtChunkIndex": "" },
    },
    { new: true, sort: { updatedAt: -1 } }
  ).lean();

  if (!source) {
    // S-8: per-user source cap (new sources only)
    const existingCount = await KnowledgeSource.countDocuments({ userId });
    if (existingCount >= env.MAX_SOURCES_PER_USER) {
      throw new HttpError(
        429,
        "RATE_LIMITED",
        `You have reached the maximum of ${env.MAX_SOURCES_PER_USER} knowledge sources. Delete one before uploading.`
      );
    }
    const created = await KnowledgeSource.create({
      userId,
      name,
      fileHash,
      type: detected.type,
      status: "pending",
      fileSize: file.size,
      mimeType: detected.mime,
    });
    source = created.toObject();
  }

  const dto = toKnowledgeDTO(source);
  // ADR-5: 202 immediately; ingestion runs on the in-process queue
  res.status(202).json({
    source: dto,
    sourceId: dto.id,
    name: dto.name,
    status: dto.status,
    message: "File received. Indexing in background. Poll /knowledge/:sourceId/status for updates.",
  });

  void enqueueIngest({
    userId,
    sourceId: dto.id,
    buffer: file.buffer,
    fileName: dto.name,
    type: detected.type as KnowledgeFileType,
  });
};

// ─── Read ─────────────────────────────────────────────────────────────────────

export const listKnowledge = async (req: Request, res: Response) => {
  const userId = userIdOf(req);
  await markStaleSources(userId); // I-11
  // S-7: never return embeddings, chunk text or file hashes
  const sources = await KnowledgeSource.find({ userId }).sort({ createdAt: -1 }).lean();
  res.json(sources.map(toKnowledgeDTO));
};

export const getKnowledgeSource = async (req: Request, res: Response) => {
  await markStaleSources(userIdOf(req));
  res.json(toKnowledgeDTO(await findOwnedSource(req)));
};

/** Legacy poll endpoint: { sourceId, status, chunkCount, name, errorMessage, truncated } + progress. */
export const getKnowledgeStatus = async (req: Request, res: Response) => {
  await markStaleSources(userIdOf(req));
  res.json(toLegacyStatus(await findOwnedSource(req)));
};

export const getKnowledgeConfig = async (_req: Request, res: Response) => {
  res.json(
    toKnowledgeConfig({
      maxFileMb: MAX_UPLOAD_SIZE_MB,
      allowedExtensions: ALLOWED_UPLOAD_EXTENSIONS,
      maxSources: env.MAX_SOURCES_PER_USER,
      maxChunks: env.MAX_CHUNKS_PER_USER,
    })
  );
};

// ─── Retry ────────────────────────────────────────────────────────────────────

export const retryKnowledge = async (req: Request, res: Response) => {
  const userId = userIdOf(req);
  await markStaleSources(userId);
  const result = await retryIngest(req.params.sourceId, userId);
  if (!result.ok) {
    switch (result.reason) {
      case "not_found":
        throw HttpError.notFound("Knowledge source not found.");
      case "busy":
        throw HttpError.conflict("This document is already being indexed.");
      case "not_retryable":
        throw HttpError.conflict("This document is already indexed.");
      default:
        throw HttpError.conflict("This document cannot be retried. Please upload the file again.");
    }
  }
  res.status(202).json({ source: toKnowledgeDTO(result.source) });
};

// ─── Delete ───────────────────────────────────────────────────────────────────

export const deleteKnowledge = async (req: Request, res: Response) => {
  const userId = userIdOf(req);
  const { sourceId } = req.params;

  // S-6: compound lookup, _id + userId
  const source = await KnowledgeSource.findOneAndDelete({ _id: sourceId, userId });
  if (!source) throw HttpError.notFound("Knowledge source not found.");

  // Stop a running ingest; it also removes anything it wrote after this point.
  cancelIngest(sourceId);
  const { deletedCount } = await KnowledgeChunk.deleteMany({ sourceId: oid(sourceId), userId });
  await KnowledgeSourceText.deleteMany({ sourceId: oid(sourceId) });

  req.log?.info?.({ sourceId, chunksDeleted: deletedCount }, "knowledge source deleted");
  res.json({
    message: "Knowledge source and all associated chunks removed.",
    chunksDeleted: deletedCount,
  });
};

// ─── Watchdog ─────────────────────────────────────────────────────────────────

/**
 * Stale ingestion watchdog (I-11). Jobs queued or running in this process are
 * skipped. Otherwise:
 *   indexing with no heartbeat (updatedAt) for 5 min -> error "stalled"
 *   pending for 15 min                              -> error
 * Retryable when the extracted text was stored.
 */
export async function markStaleSources(userId: string, now = Date.now()): Promise<number> {
  const active = activeIngestIds()
    .filter((id) => mongoose.isValidObjectId(id))
    .map(oid);
  const staleFilter = {
    userId: oid(userId),
    _id: { $nin: active },
    $or: [
      { status: "indexing", updatedAt: { $lt: new Date(now - STALE_INDEXING_MS) } },
      { status: "pending", updatedAt: { $lt: new Date(now - STALE_PENDING_MS) } },
    ],
  };
  const stale = await KnowledgeSource.find(staleFilter, { _id: 1, status: 1 }).lean();
  if (stale.length === 0) return 0;

  const ids = stale.map((s) => s._id);
  const withText = await KnowledgeSourceText.find({ sourceId: { $in: ids } }, { sourceId: 1 }).lean();
  const hasText = new Set(withText.map((t: any) => String(t.sourceId)));

  for (const canRetry of [true, false]) {
    const group = ids.filter((id) => hasText.has(String(id)) === canRetry);
    if (group.length === 0) continue;
    await KnowledgeSource.updateMany(
      { ...staleFilter, _id: { $in: group } },
      {
        $set: {
          status: "error",
          canRetry,
          chunksDone: 0,
          "metadata.errorMessage": canRetry
            ? "Indexing stalled. Click Retry to try again."
            : "Indexing stalled. Please upload the file again.",
        },
      }
    );
  }
  await KnowledgeChunk.deleteMany({ sourceId: { $in: ids } });
  return ids.length;
}
