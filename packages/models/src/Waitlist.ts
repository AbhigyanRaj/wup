import mongoose from "mongoose";
import { registerModel } from "./registerModel";

/**
 * Interest in a not-yet-supported bridge type. Either userId (signed in) or
 * email (anonymous) identifies the requester.
 */
const waitlistSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  email: { type: String, trim: true, lowercase: true, maxlength: 254 },
  feature: {
    type: String,
    enum: ["postgresql", "mysql"],
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
});

waitlistSchema.index({ feature: 1, createdAt: -1 });

export const Waitlist = registerModel("Waitlist", () => mongoose.model("Waitlist", waitlistSchema));
