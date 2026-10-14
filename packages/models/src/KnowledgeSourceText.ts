import mongoose from "mongoose";
import { registerModel } from "./registerModel";

/**
 * The extracted plain text of one KnowledgeSource, gzipped. Kept so a failed or
 * quota-interrupted ingestion can be retried without the original upload.
 * Deleted together with its KnowledgeSource.
 */
const knowledgeSourceTextSchema = new mongoose.Schema(
  {
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "KnowledgeSource",
      required: true,
      unique: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // gzip of the UTF-8 text
    gz: { type: Buffer, required: true },
    // Uncompressed length in characters
    chars: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const KnowledgeSourceText = registerModel("KnowledgeSourceText", () =>
  mongoose.model("KnowledgeSourceText", knowledgeSourceTextSchema)
);
