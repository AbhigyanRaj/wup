import mongoose from "mongoose";
import { registerModel } from "./registerModel";

/**
 * KnowledgeSource tracks every file a user has uploaded for RAG indexing.
 * One record per file: the chunks live in KnowledgeChunk, the extracted text
 * (gzipped, for retries) in KnowledgeSourceText.
 */
const knowledgeSourceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // SHA-256 hash of the file buffer — used to detect duplicate uploads (I-8)
    fileHash: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      // "url" is legacy (never produced by the current upload flow)
      enum: ["pdf", "txt", "md", "csv", "docx", "url"],
      required: true,
      default: "pdf",
    },
    /**
     * Lifecycle statuses:
     *  pending    → created, not yet started
     *  indexing   → ingestion is running right now
     *  indexed    → fully indexed and ready for retrieval
     *  error      → ingestion failed (see metadata.errorMessage)
     *  error_quota → embedding quota exhausted mid-ingestion (I-6)
     */
    status: {
      type: String,
      enum: ["pending", "indexing", "indexed", "error", "error_quota"],
      default: "pending",
    },
    chunkCount: {
      type: Number,
      default: 0,
    },
    // Indexing progress: chunks planned vs embedded so far
    chunksTotal: {
      type: Number,
      default: 0,
    },
    chunksDone: {
      type: Number,
      default: 0,
    },
    // Ingestion attempts (first run + retries)
    attempts: {
      type: Number,
      default: 0,
    },
    // true when a failed source can be retried from its stored text
    canRetry: {
      type: Boolean,
      default: false,
    },
    fileSize: {
      type: Number, // bytes
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    metadata: {
      errorMessage: { type: String },
      failedAtChunkIndex: { type: Number }, // for partial failure diagnostics
      truncated: { type: Boolean, default: false }, // true if chunk cap was hit (I-9)
      indexingStartedAt: { type: Date },
    },
  },
  {
    timestamps: true, // createdAt + updatedAt auto-managed
  }
);

// Compound index for duplicate detection (I-8)
knowledgeSourceSchema.index({ userId: 1, fileHash: 1 });

// Stale watchdog query index (I-11)
knowledgeSourceSchema.index({ status: 1, updatedAt: 1 });

export const KnowledgeSource = registerModel("KnowledgeSource", () =>
  mongoose.model("KnowledgeSource", knowledgeSourceSchema)
);
