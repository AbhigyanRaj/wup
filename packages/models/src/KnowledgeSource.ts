import mongoose from "mongoose";

/**
 * KnowledgeSource tracks every file a user has uploaded for RAG indexing.
 * One record per file — the actual content lives in KnowledgeChunk.
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
      enum: ["pdf", "txt", "url"],
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

export const KnowledgeSource = mongoose.model(
  "KnowledgeSource",
  knowledgeSourceSchema
);
