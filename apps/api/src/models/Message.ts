import mongoose from "mongoose";

/**
 * The Message model represents an individual entry in a Chat thread.
 * ragSources stores the RAG citation data returned by the Brain so the
 * frontend can render citation pills when the conversation is reloaded.
 */

const messageSchema = new mongoose.Schema({
  chatId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Chat", 
    required: true 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  role: { 
    type: String, 
    enum: ["user", "assistant", "system"], 
    required: true 
  },
  content: { 
    type: String, 
    required: true 
  },
  // RAG source citations — only present on assistant messages (optional)
  ragSources: [{
    sourceFile: { type: String },
    pageNumber: { type: Number },
    score: { type: Number },
    text: { type: String },
  }],
  // Web search grounding citations (optional)
  webSources: [{
    title: { type: String },
    url: { type: String },
  }],
  visualType: { 
    type: String, 
    enum: ["none", "mermaid", "chart", "table", "diagram"], 
    default: "none" 
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
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Index by chatId for fast retrieval of entire conversations
messageSchema.index({ chatId: 1, createdAt: 1 });

export const Message = mongoose.model("Message", messageSchema);

