import mongoose from "mongoose";
import { registerModel } from "./registerModel";

/**
 * One row per applied data migration. _id is the migration id, e.g. "002-encrypt-byok".
 */
const migrationSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  appliedAt: { type: Date, default: Date.now },
});

export const Migration = registerModel("Migration", () => mongoose.model("Migration", migrationSchema));
