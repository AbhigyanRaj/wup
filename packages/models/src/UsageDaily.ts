import mongoose from "mongoose";
import { registerModel } from "./registerModel";

/**
 * Per-user, per-day usage counters (UTC day). Updated with $inc upserts on
 * { userId, day }, so the unique index doubles as the upsert key.
 */
const usageDailySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  // "YYYY-MM-DD" (UTC)
  day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  messages: { type: Number, default: 0 },
  research: { type: Number, default: 0 },
  tokensIn: { type: Number, default: 0 },
  tokensOut: { type: Number, default: 0 },
  // { [provider]: { messages, tokensIn, tokensOut } }
  byProvider: { type: mongoose.Schema.Types.Mixed, default: {} },
});

usageDailySchema.index({ userId: 1, day: 1 }, { unique: true });

export const UsageDaily = registerModel("UsageDaily", () => mongoose.model("UsageDaily", usageDailySchema));
