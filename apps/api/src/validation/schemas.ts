import { z } from "zod";

const connectionType = z.string().refine(
  (val) => ["mongodb", "sheets", "postgresql", "supabase"].includes(val),
  { message: "Direct bridge only supported for MongoDB, Sheets, PostgreSQL, or Supabase" }
);

const scopeSchema = z
  .array(
    z.object({
      db: z.string().min(1),
      collections: z.array(z.string().min(1)).min(1),
    })
  )
  .max(100);

// { "db.collection": ["field.path", ...] }
const redactedFieldsSchema = z.record(z.string(), z.array(z.string()));

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const createConnectionSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, "Name is required").max(80),
    type: connectionType,
    config: z.union([z.string(), z.record(z.string(), z.any())]).describe("Encrypted or raw configuration object"),
    scope: scopeSchema.optional(),
    redactedFields: redactedFieldsSchema.optional(),
  }),
});

export const testConnectionSchema = z.object({
  body: z.object({
    type: connectionType,
    config: z.string().min(1, "Connection URL is required"),
  }),
});

export const updateConnectionSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(80).optional(),
    scope: scopeSchema.optional(),
    redactedFields: redactedFieldsSchema.optional(),
  }),
});

export const saveMessageSchema = z.object({
  body: z.object({
    content: z.string().min(1, "Message content cannot be empty"),
    role: z.enum(["user", "assistant"]).optional().default("user"),
    model: z.string().optional(),
    searchWeb: z.boolean().optional(),
  }),
});

export const updateChatSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1).max(120).optional(),
    bridgeIds: z.array(objectId).max(50).optional(),
  }),
});
