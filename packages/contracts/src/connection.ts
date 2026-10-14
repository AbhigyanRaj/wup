import { z } from "zod";
import { ISODateSchema, IdSchema } from "./common";

/** Bridge types that can be created. Legacy rows may still hold "postgresql" or "supabase". */
export const BRIDGE_TYPES = ["mongodb", "sheets"] as const;
export const BridgeTypeSchema = z.enum(BRIDGE_TYPES, {
  message: "Bridges currently support MongoDB and Google Sheets",
});
export type BridgeType = z.infer<typeof BridgeTypeSchema>;

export const BridgeStatusSchema = z.enum(["scanning", "active", "error"]);
export type BridgeStatus = z.infer<typeof BridgeStatusSchema>;

export const ScopeEntrySchema = z.object({
  db: z.string().min(1),
  /** ["*"] means every collection in the db */
  collections: z.array(z.string().min(1)).min(1),
});
export type ScopeEntry = z.infer<typeof ScopeEntrySchema>;

export const ScopeSchema = z.array(ScopeEntrySchema).max(100);

/** { "db.collection": ["field.path", ...] } */
export const RedactionMapSchema = z.record(z.string(), z.array(z.string()));
export type RedactionMap = z.infer<typeof RedactionMapSchema>;

export const SheetTabSchema = z.object({
  name: z.string(),
  rows: z.number(),
  cols: z.number(),
  headers: z.array(z.string()),
});
export type SheetTab = z.infer<typeof SheetTabSchema>;

// ─── Responses ────────────────────────────────────────────────────────────────

export const BridgeSummarySchema = z.object({
  id: IdSchema,
  /** @deprecated alias of id, kept for older clients */
  _id: IdSchema,
  name: z.string(),
  type: BridgeTypeSchema,
  /** System bridges (the demo sample) are read-only and cannot be deleted by the user. */
  isSystem: z.boolean(),
  scope: z.array(ScopeEntrySchema),
  redactedFields: RedactionMapSchema,
  suggestions: z.array(z.string()),
  status: BridgeStatusSchema,
  lastError: z.string().nullable(),
  lastScannedAt: ISODateSchema.nullable(),
  lastUsedAt: ISODateSchema.nullable(),
  stats: z.object({ databases: z.number(), collections: z.number() }),
  /** Present for sheets bridges. */
  sheets: z.object({ title: z.string(), tabs: z.array(SheetTabSchema) }).nullable(),
  createdAt: ISODateSchema,
});
export type BridgeSummary = z.infer<typeof BridgeSummarySchema>;

export const SchemaFieldSchema = z.object({
  path: z.string(),
  types: z.array(z.string()),
  /** % of sampled documents containing this field */
  pct: z.number(),
});
export type SchemaField = z.infer<typeof SchemaFieldSchema>;

export const BridgeDetailsSchema = BridgeSummarySchema.extend({
  schema: z.array(
    z.object({
      db: z.string(),
      collections: z.array(
        z.object({
          name: z.string(),
          /** null for views */
          count: z.number().nullable(),
          fields: z.array(SchemaFieldSchema),
        })
      ),
    })
  ),
});
export type BridgeDetails = z.infer<typeof BridgeDetailsSchema>;

export const MongoTestResultSchema = z.object({
  ok: z.literal(true),
  type: z.literal("mongodb"),
  databases: z.array(
    z.object({
      db: z.string(),
      collections: z.array(
        z.object({
          name: z.string(),
          /** null for views */
          count: z.number().nullable(),
          type: z.enum(["collection", "view"]).optional(),
        })
      ),
    })
  ),
  /** Fields that look sensitive, pre-selected for redaction: { "db.collection": [paths] } */
  sensitive: RedactionMapSchema,
  defaultDb: z.string(),
});
export type MongoTestResult = z.infer<typeof MongoTestResultSchema>;

export const SheetsTestResultSchema = z.object({
  ok: z.literal(true),
  type: z.literal("sheets"),
  spreadsheetId: z.string(),
  title: z.string(),
  tabs: z.array(SheetTabSchema),
});
export type SheetsTestResult = z.infer<typeof SheetsTestResultSchema>;

export const TestConnectionResultSchema = z.discriminatedUnion("type", [
  MongoTestResultSchema,
  SheetsTestResultSchema,
]);
export type TestConnectionResult = z.infer<typeof TestConnectionResultSchema>;

export const CreateConnectionResponseSchema = z.object({
  id: IdSchema,
  connection: BridgeSummarySchema,
  message: z.string().optional(),
});
export type CreateConnectionResponse = z.infer<typeof CreateConnectionResponseSchema>;

// ─── Request bodies ───────────────────────────────────────────────────────────

const BridgeNameSchema = z.string().trim().min(1, "Name is required").max(80);

/** A MongoDB URL, or a Google Sheets URL / spreadsheet id. */
const ConnectionConfigString = z
  .string()
  .trim()
  .min(1, "Connection URL is required")
  .max(4096, "Connection URL is too long");

export const TestConnectionBodySchema = z.object({
  type: BridgeTypeSchema,
  config: ConnectionConfigString,
});
export type TestConnectionBody = z.infer<typeof TestConnectionBodySchema>;

export const CreateConnectionBodySchema = z.object({
  name: BridgeNameSchema,
  type: BridgeTypeSchema,
  /** A connection string, or a raw config object (stored encrypted either way). */
  config: z.union([ConnectionConfigString, z.record(z.string(), z.unknown())]),
  scope: ScopeSchema.optional(),
  redactedFields: RedactionMapSchema.optional(),
});
export type CreateConnectionBody = z.infer<typeof CreateConnectionBodySchema>;

export const UpdateConnectionBodySchema = z.object({
  name: BridgeNameSchema.optional(),
  scope: ScopeSchema.optional(),
  redactedFields: RedactionMapSchema.optional(),
});
export type UpdateConnectionBody = z.infer<typeof UpdateConnectionBodySchema>;
