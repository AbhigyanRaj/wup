import mongoose from "mongoose";

/**
 * The Connection model represents an external data bridge (MongoDB, Sheets, etc.)
 * Config data is stored in an encrypted format.
 */

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
  metadata: {
    lastSynced: { type: Date },
    status: { type: String, default: "active" },
    sourceInfo: { type: Object }
  },
  createdAt: { type: Date, default: Date.now }
});

// Ensure a user doesn't have duplicate connection names
connectionSchema.index({ userId: 1, name: 1 }, { unique: true });

export const Connection = mongoose.model("Connection", connectionSchema);
