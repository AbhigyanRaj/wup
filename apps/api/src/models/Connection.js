"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Connection = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
/**
 * The Connection model represents an external data bridge (MongoDB, Sheets, etc.)
 * Config data is stored in an encrypted format.
 */
const connectionSchema = new mongoose_1.default.Schema({
    userId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
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
exports.Connection = mongoose_1.default.model("Connection", connectionSchema);
