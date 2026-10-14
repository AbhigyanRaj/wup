import mongoose from "mongoose";
import { registerModel } from "./registerModel";

/**
 * The Message model represents an individual entry in a Chat thread.
 *
 * Citations live in `sources` (see Source in @wup/contracts). The older
 * `ragSources` / `webSources` arrays are kept so legacy messages still render;
 * migration 004-backfill-chats-messages converts them.
 */

const querySchema = new mongoose.Schema(
  {
    tool: { type: String },
    connectionName: { type: String },
    db: { type: String },
    collection: { type: String },
    query: { type: String }, // pretty-printed Extended JSON
    rowCount: { type: Number },
    truncated: { type: Boolean },
    durationMs: { type: Number },
    error: { type: String },
  },
  // "collection" is a reserved Mongoose path name; here it is just a stored string
  { _id: false, suppressReservedKeysWarning: true }
);

/**
 * One citation. Mirrors the Source union in @wup/contracts:
 *   kind "doc":  sourceId, page, chunkIndex, snippet, score
 *   kind "web":  url, snippet
 *   kind "data": connectionName, db, collection, queryIndex
 * Only a short snippet is stored, never the full chunk text.
 */
const sourceSchema = new mongoose.Schema(
  {
    n: { type: Number, required: true },
    kind: { type: String, enum: ["doc", "web", "data"], required: true },
    title: { type: String, default: "" },
    cited: { type: Boolean, default: false },
    // doc
    sourceId: { type: mongoose.Schema.Types.ObjectId, ref: "KnowledgeSource" },
    page: { type: Number },
    chunkIndex: { type: Number },
    score: { type: Number },
    // doc + web
    snippet: { type: String },
    // web
    url: { type: String },
    // data
    connectionName: { type: String },
    db: { type: String },
    collection: { type: String },
    queryIndex: { type: Number },
  },
  { _id: false, suppressReservedKeysWarning: true }
);

const followUpSchema = new mongoose.Schema(
  {
    label: { type: String },
    suggestedPrompt: { type: String },
  },
  { _id: false }
);

const clarificationSchema = new mongoose.Schema(
  {
    question: { type: String },
    options: { type: [String], default: [] },
    allowFreeText: { type: Boolean, default: true },
  },
  { _id: false }
);

const researchStepSchema = new mongoose.Schema(
  {
    id: { type: String },
    title: { type: String },
    status: { type: String, enum: ["pending", "running", "done", "error", "skipped"] },
    detail: { type: String },
    sourceNs: { type: [Number], default: [] },
    startedAt: { type: Date },
    finishedAt: { type: Date },
  },
  { _id: false }
);

const researchSchema = new mongoose.Schema(
  {
    steps: { type: [researchStepSchema], default: [] },
    durationMs: { type: Number },
  },
  { _id: false }
);

const modelInfoSchema = new mongoose.Schema(
  {
    provider: { type: String },
    id: { type: String },
    usingOwnKey: { type: Boolean, default: false },
  },
  { _id: false }
);

const metricsSchema = new mongoose.Schema(
  {
    latencyMs: { type: Number },
    firstTokenMs: { type: Number },
    tokensIn: { type: Number },
    tokensOut: { type: Number },
    toolCalls: { type: Number, default: 0 },
  },
  { _id: false }
);

const feedbackSchema = new mongoose.Schema(
  {
    rating: { type: String, enum: ["up", "down"] },
    note: { type: String, maxlength: 1000 },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const messageErrorSchema = new mongoose.Schema(
  {
    code: { type: String },
    message: { type: String },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema({
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Chat",
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  role: {
    type: String,
    enum: ["user", "assistant", "system"],
    required: true,
  },
  // Assistant messages may be empty (stopped or failed before any token).
  content: {
    type: String,
    default: "",
    required: function (this: { role?: string }) {
      return this.role === "user";
    },
  },
  status: {
    type: String,
    enum: ["complete", "stopped", "error"],
    default: "complete",
  },
  mode: {
    type: String,
    enum: ["chat", "research"],
    default: "chat",
  },
  // For assistant messages: the user message it answers (regenerate keeps siblings).
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Message",
    default: null,
  },
  sources: { type: [sourceSchema], default: [] },
  followUps: { type: [followUpSchema], default: [] },
  clarification: { type: clarificationSchema, default: null },
  research: { type: researchSchema, default: null },
  model: { type: modelInfoSchema, default: null },
  metrics: { type: metricsSchema, default: null },
  feedback: { type: feedbackSchema, default: null },
  error: { type: messageErrorSchema, default: null },

  /** @deprecated use sources (kind "doc") */
  ragSources: [{
    sourceFile: { type: String },
    pageNumber: { type: Number },
    score: { type: Number },
    text: { type: String },
  }],
  /** @deprecated use sources (kind "web") */
  webSources: [{
    title: { type: String },
    url: { type: String },
  }],
  visualType: {
    type: String,
    enum: ["none", "mermaid", "chart", "table", "diagram"],
    default: "none",
  },
  chartData: {
    type: { type: String },
    xAxisKey: { type: String },
    yAxisKey: { type: String },
    title: { type: String },
    series: [mongoose.Schema.Types.Mixed],
  },
  tableData: {
    columns: [String],
    rows: [mongoose.Schema.Types.Mixed],
  },
  diagramData: {
    nodes: [{
      id: { type: String },
      label: { type: String },
      sublabel: { type: String },
      type: { type: String }, // "start" | "action" | "decision" | "success" | "error"
    }],
    edges: [{
      from: { type: String },
      to: { type: String },
      label: { type: String },
    }],
  },
  // Database queries executed to produce this answer (shown as "Query used")
  queries: [querySchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Index by chatId for fast retrieval of entire conversations
messageSchema.index({ chatId: 1, createdAt: 1 });
// Full-text chat search, always scoped to one user
messageSchema.index({ userId: 1, content: "text" });

export const Message = registerModel("Message", () => mongoose.model("Message", messageSchema));
