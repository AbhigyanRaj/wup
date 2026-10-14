import mongoose from "mongoose";
import { registerModel } from "./registerModel";

export const PUBLIC_TOOL_CACHE_TTL_S = 7 * 24 * 60 * 60;

/**
 * Cached public tool outputs. _id is a hash of (tool, normalised input).
 * Entries expire 7 days after creation.
 */
const publicToolCacheSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  tool: { type: String, required: true },
  output: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now },
});

publicToolCacheSchema.index({ createdAt: 1 }, { expireAfterSeconds: PUBLIC_TOOL_CACHE_TTL_S });

export const PublicToolCache = registerModel("PublicToolCache", () =>
  mongoose.model("PublicToolCache", publicToolCacheSchema)
);
