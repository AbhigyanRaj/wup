import crypto from "crypto";
import path from "path";
import { Request, Response } from "express";
import mongoose from "mongoose";
import { KnowledgeSource } from "../models/KnowledgeSource";
import { KnowledgeChunk } from "../models/KnowledgeChunk";
import { ingestorService, type SupportedMimeType } from "@wup/ingestor";

const MAX_SOURCES_PER_USER = parseInt(process.env.MAX_SOURCES_PER_USER ?? "20", 10);
const MAX_CHUNKS_PER_USER = parseInt(process.env.MAX_CHUNKS_PER_USER ?? "5000", 10);
const STALE_INDEXING_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes (I-11 watchdog)

// ─── Upload ───────────────────────────────────────────────────────────────────

export const uploadKnowledge = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const file = req.file;

  // Guard: multer should have caught this, but be defensive
  if (!file) {
    res.status(400).json({ error: "No file uploaded. Send a file with field name 'file'." });
    return;
  }

  // I-10: Empty file check
  if (file.size === 0) {
    res.status(400).json({ error: "File is empty." });
    return;
  }

  try {
    // S-8: Enforce per-user source cap before we do anything
    const existingCount = await KnowledgeSource.countDocuments({ userId });
    if (existingCount >= MAX_SOURCES_PER_USER) {
      res.status(429).json({
        error: `You have reached the maximum of ${MAX_SOURCES_PER_USER} knowledge sources. Delete one before uploading.`,
      });
      return;
    }

    // S-8: Enforce per-user chunk cap
    const chunkCount = await KnowledgeChunk.countDocuments({ userId });
    if (chunkCount >= MAX_CHUNKS_PER_USER) {
      res.status(429).json({
        error: `Chunk limit of ${MAX_CHUNKS_PER_USER} reached. Remove some documents to free up space.`,
      });
      return;
    }

    // I-8: Duplicate detection via SHA-256 hash of the file buffer
    const fileHash = crypto
      .createHash("sha256")
      .update(file.buffer)
      .digest("hex");

    const duplicate = await KnowledgeSource.findOne({ userId, fileHash });
    if (duplicate) {
      res.status(409).json({
        error: "This document is already indexed.",
        sourceId: duplicate._id,
        status: duplicate.status,
      });
      return;
    }

    // S-4: Sanitize filename — prevent path traversal
    const safeName = path.basename(file.originalname);

    // Create the KnowledgeSource record (status: "pending")
    const source = await KnowledgeSource.create({
      userId,
      name: safeName,
      fileHash,
      type: file.mimetype === "application/pdf" ? "pdf" : "txt",
      status: "pending",
      fileSize: file.size,
      mimeType: file.mimetype,
    });

    // ADR-5: Return 202 immediately — ingestion runs in the background
    res.status(202).json({
      sourceId: source._id,
      name: safeName,
      status: "indexing",
      message: "File received. Indexing in background. Poll /knowledge/:sourceId/status for updates.",
    });

    // Kick off async ingestion — do NOT await (non-blocking)
    ingestorService
      .ingest(
        userId,
        source._id.toString(),
        file.buffer,
        file.mimetype as SupportedMimeType,
        safeName
      )
      .catch((err) => {
        // This should never fire (ingestorService catches internally),
        // but log if it somehow escapes
        console.error("[WUP API] Unexpected ingestion escape:", err);
      });
  } catch (err) {
    console.error("[WUP API] Upload handler error:", err);
    res.status(500).json({ error: "Failed to initiate document indexing." });
  }
};

// ─── List Sources ─────────────────────────────────────────────────────────────

export const listKnowledge = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  try {
    // Run stale watchdog on every list call (I-11)
    await markStaleSources(userId);

    // S-7: Never return embedding or chunk text to the frontend
    const sources = await KnowledgeSource.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    res.json(sources);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch knowledge sources." });
  }
};

// ─── Status Poll ──────────────────────────────────────────────────────────────

export const getKnowledgeStatus = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { sourceId } = req.params;

  try {
    // I-11: Run stale watchdog before returning status
    await markStaleSources(userId);

    const source = await KnowledgeSource.findOne({ _id: sourceId, userId }).lean();
    if (!source) {
      res.status(404).json({ error: "Knowledge source not found." });
      return;
    }

    res.json({
      sourceId: source._id,
      status: source.status,
      chunkCount: source.chunkCount,
      name: source.name,
      errorMessage: source.metadata?.errorMessage,
      truncated: source.metadata?.truncated,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch indexing status." });
  }
};

// ─── Delete Source ────────────────────────────────────────────────────────────

export const deleteKnowledge = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { sourceId } = req.params;

  try {
    // S-6: Compound lookup — _id + userId — never just _id alone
    const source = await KnowledgeSource.findOneAndDelete({
      _id: sourceId,
      userId,
    });

    if (!source) {
      res.status(404).json({ error: "Knowledge source not found." });
      return;
    }

    // Cascade: delete all chunks belonging to this source
    const { deletedCount } = await KnowledgeChunk.deleteMany({
      sourceId: new mongoose.Types.ObjectId(sourceId),
      userId, // Belt-and-suspenders: also match userId
    });

    console.log(
      `[WUP API] Deleted sourceId=${sourceId} + ${deletedCount} chunks for userId=${userId}`
    );

    res.json({
      message: "Knowledge source and all associated chunks removed.",
      chunksDeleted: deletedCount,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete knowledge source." });
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Stale ingestion watchdog (I-11).
 * Any source stuck in "indexing" for more than STALE_INDEXING_THRESHOLD_MS
 * is marked as "error" — this catches process crashes and unhandled failures.
 */
async function markStaleSources(userId: string): Promise<void> {
  const staleThreshold = new Date(Date.now() - STALE_INDEXING_THRESHOLD_MS);
  await KnowledgeSource.updateMany(
    {
      userId,
      status: "indexing",
      updatedAt: { $lt: staleThreshold },
    },
    {
      $set: {
        status: "error",
        "metadata.errorMessage":
          "Indexing timed out. The process may have crashed. Please re-upload the file.",
      },
    }
  );
}
