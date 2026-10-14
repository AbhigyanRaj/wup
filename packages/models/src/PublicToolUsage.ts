import mongoose from "mongoose";
import { registerModel } from "./registerModel";

/**
 * Global daily call counter for the public (no account) tools, used as a
 * spend cap. _id is the UTC day "YYYY-MM-DD".
 */
const publicToolUsageSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  count: { type: Number, default: 0 },
});

export const PublicToolUsage = registerModel("PublicToolUsage", () =>
  mongoose.model("PublicToolUsage", publicToolUsageSchema)
);
