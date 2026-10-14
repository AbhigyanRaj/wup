import mongoose from "mongoose";
import { registerModel } from "./registerModel";

/**
 * The Chat model represents a single conversation thread.
 */

const chatSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      default: "Untitled chat",
    },
    // "auto" titles may be replaced by the generated title; "user" titles never are.
    // Defaults to "user" so existing chats keep their titles.
    titleSource: {
      type: String,
      enum: ["auto", "user"],
      default: "user",
    },
    pinned: {
      type: Boolean,
      default: false,
    },
    // Denormalised; backfilled by migration 004-backfill-chats-messages.
    messageCount: {
      type: Number,
      default: 0,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    /** @deprecated unused, removed by a later migration */
    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active",
    },
    // Data bridges this chat may use. Empty = all of the user's bridges.
    bridgeIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Connection",
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // createdAt stays the explicit field above; mongoose only manages updatedAt.
    timestamps: { createdAt: false, updatedAt: true },
  }
);

// Sidebar list: pinned first, then most recent, stable cursor on _id
chatSchema.index({ userId: 1, pinned: -1, lastMessageAt: -1, _id: -1 });
// Title search
chatSchema.index({ userId: 1, title: 1 });

export const Chat = registerModel("Chat", () => mongoose.model("Chat", chatSchema));
