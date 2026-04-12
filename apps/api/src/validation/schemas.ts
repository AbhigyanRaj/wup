import { z } from "zod";

export const createConnectionSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required"),
    type: z.enum(["mongodb", "sheets", "postgresql", "supabase"], {
      errorMap: () => ({ message: "Direct bridge only supported for MongoDB, Sheets, PostgreSQL, or Supabase" }),
    }),
    config: z.union([z.string(), z.record(z.any())]).describe("Encrypted or raw configuration object"),
  }),
});

export const saveMessageSchema = z.object({
  body: z.object({
    content: z.string().min(1, "Message content cannot be empty"),
    role: z.enum(["user", "assistant"]).optional().default("user"),
    model: z.string().optional(),
  }),
});
