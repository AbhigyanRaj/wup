import mongoose from "mongoose";

/**
 * The Chat model represents a single conversation thread.
 */

const chatSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  title: { 
    type: String, 
    required: true, 
    trim: true,
    default: "Untitled chat"
  },
  lastMessageAt: { 
    type: Date, 
    default: Date.now 
  },
  status: { 
    type: String, 
    enum: ["active", "archived"], 
    default: "active" 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

export const Chat = mongoose.model("Chat", chatSchema);
