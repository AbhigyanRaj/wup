import mongoose from "mongoose";
import { registerModel } from "./registerModel";

/** Messages sent through the public contact form. */
const contactMessageSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  topic: { type: String, required: true, trim: true, maxlength: 80 },
  message: { type: String, required: true, maxlength: 4000 },
  createdAt: { type: Date, default: Date.now },
});

contactMessageSchema.index({ createdAt: -1 });

export const ContactMessage = registerModel("ContactMessage", () =>
  mongoose.model("ContactMessage", contactMessageSchema)
);
