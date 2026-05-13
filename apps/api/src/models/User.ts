import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: "Founder" },
  customApiKey: { type: String, default: "" },
  customApiProvider: { type: String, default: "gemini" },
  freeTierUsage: { type: Number, default: 0 },
  freeTierLimit: { type: Number, default: 50 },
  createdAt: { type: Date, default: Date.now }
});

export const User = mongoose.model("User", userSchema);
