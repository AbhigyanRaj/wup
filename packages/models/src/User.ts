import mongoose from "mongoose";
import { registerModel } from "./registerModel";

const preferencesSchema = {
  aboutMe: { type: String, default: "", maxlength: 1500 },
  responseStyle: {
    type: String,
    enum: ["concise", "balanced", "detailed"],
    default: "balanced",
  },
  customInstructions: { type: String, default: "", maxlength: 1500 },
  preferTables: { type: Boolean, default: false },
  showQueriesByDefault: { type: Boolean, default: false },
};

const userSchema = new mongoose.Schema({
  // Unique, but NOT lowercased yet: legacy mixed-case rows exist.
  // Migration 003-lowercase-emails normalises them; add `lowercase: true` after it has run.
  // Demo users get a synthetic unique address, since the unique index is not sparse.
  email: { type: String, required: true, unique: true },
  // bcrypt hash. Optional so demo users can be created without one (password: null).
  password: { type: String },
  name: { type: String, trim: true, maxlength: 80 },
  role: { type: String, default: "Founder" },

  // Bumped on password change / logout-everywhere to invalidate older sessions.
  sessionVersion: { type: Number, default: 0 },
  lastLoginAt: { type: Date },

  // Demo accounts
  isDemo: { type: Boolean, default: false },
  demoExpiresAt: { type: Date },
  // When set on a demo user, the TTL index below removes the user document.
  purgeAt: { type: Date },
  // Set while an account deletion (cascade) is in progress.
  deletingAt: { type: Date },

  preferences: preferencesSchema,
  onboarding: {
    welcomeSeenAt: { type: Date },
    checklistDismissedAt: { type: Date },
  },

  // BYOK. customApiKey is the legacy plaintext key; migration 002-encrypt-byok
  // moves it into customApiKeyEnc and clears it.
  /** @deprecated plaintext, use customApiKeyEnc */
  customApiKey: { type: String, default: "" },
  customApiKeyEnc: { type: String },
  // Display hint only, e.g. "sk-ant...abcd". Never enough to use the key.
  customApiKeyHint: { type: String },
  customApiProvider: { type: String, default: "gemini" },
  availableModels: { type: [String], default: [] },

  freeTierUsage: { type: Number, default: 0 },
  freeTierLimit: { type: Number, default: 50 },
  createdAt: { type: Date, default: Date.now },
});

// Demo users are deleted by MongoDB once purgeAt passes. Real users are never TTL'd.
userSchema.index(
  { purgeAt: 1 },
  { expireAfterSeconds: 0, partialFilterExpression: { isDemo: true } }
);
// Expiry sweeps over demo accounts
userSchema.index({ isDemo: 1, demoExpiresAt: 1 });
// Resume interrupted account deletions
userSchema.index({ deletingAt: 1 }, { sparse: true });

export const User = registerModel("User", () => mongoose.model("User", userSchema));
