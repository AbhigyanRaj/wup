import mongoose from "mongoose";
import { registerModel } from "./registerModel";

/**
 * The Connection model represents an external data bridge (MongoDB, Sheets, etc.)
 * Config data is stored in an encrypted format.
 *
 * For MongoDB bridges:
 *   - scope          → which databases/collections the AI is allowed to touch
 *   - schemaCache    → sampled field/type summary, injected into the prompt
 *   - redactedFields → per "db.collection" field paths hidden from the AI
 *
 * For Google Sheets bridges:
 *   - sheetsCache    → spreadsheet title and tab shapes, refreshed on demand
 *
 * The type enum keeps legacy values ("supabase", "postgresql") so old rows still
 * load; new bridges are limited to mongodb and sheets at the API layer.
 */

const fieldSchema = new mongoose.Schema(
  {
    path: { type: String, required: true },
    types: [String],
    pct: { type: Number, default: 0 }, // % of sampled docs containing this field
    sample: { type: String },          // short example value (never for redacted fields)
  },
  { _id: false }
);

const collectionSchemaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    count: { type: Number, default: 0 },
    fields: [fieldSchema],
    indexes: [String],
  },
  { _id: false }
);

const sheetTabSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    rows: { type: Number, default: 0 },
    cols: { type: Number, default: 0 },
    headers: { type: [String], default: [] },
  },
  { _id: false }
);

const sheetsCacheSchema = new mongoose.Schema(
  {
    title: { type: String },
    tabs: { type: [sheetTabSchema], default: [] },
    fetchedAt: { type: Date },
  },
  { _id: false }
);

const connectionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ["mongodb", "sheets", "supabase", "postgresql"],
    required: true
  },
  config: {
    type: String,
    required: true
  },
  // Empty scope = every non-system database (legacy bridges behave this way)
  scope: [
    {
      _id: false,
      db: { type: String, required: true },
      // ["*"] means all collections in the db
      collections: { type: [String], default: ["*"] },
    },
  ],
  schemaCache: {
    scannedAt: { type: Date },
    dbs: [
      {
        _id: false,
        name: { type: String, required: true },
        collections: [collectionSchemaSchema],
      },
    ],
  },
  // { "sample_mflix.users": ["password"] }
  redactedFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  // Bumped whenever redactedFields changes, so cached digests can be invalidated.
  redactionsVersion: { type: Number, default: 0 },
  // System bridges (the shared demo sample) are read-only for the user.
  isSystem: { type: Boolean, default: false },
  sheetsCache: { type: sheetsCacheSchema, default: null },
  suggestions: { type: [String], default: [] },
  metadata: {
    lastSynced: { type: Date },
    status: { type: String, default: "active" }, // "scanning" | "active" | "error"
    lastError: { type: String },
    lastUsedAt: { type: Date },
    sourceInfo: { type: Object }
  },
  createdAt: { type: Date, default: Date.now }
});

// Ensure a user doesn't have duplicate connection names
connectionSchema.index({ userId: 1, name: 1 }, { unique: true });
// Bridge list, newest first
connectionSchema.index({ userId: 1, createdAt: -1 });

export const Connection = registerModel("Connection", () => mongoose.model("Connection", connectionSchema));
