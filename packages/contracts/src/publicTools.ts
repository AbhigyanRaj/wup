import { z } from "zod";
import { EmailSchema } from "./auth";
import { LIMITS } from "./common";

/**
 * Free public tools (no account needed). Each request may carry a Cloudflare
 * Turnstile token; the server decides whether it is required.
 */

export const PUBLIC_TOOLS = ["mongodb-query", "mongodb-aggregation", "aggregation-explain", "sql-to-mongodb"] as const;
export const PublicToolSchema = z.enum(PUBLIC_TOOLS);
export type PublicTool = z.infer<typeof PublicToolSchema>;

const TurnstileTokenSchema = z.string().max(4096).optional();

const nonBlank = (max: number, label: string) =>
  z
    .string()
    .max(max, `${label} is limited to ${max} characters`)
    .refine((v) => v.trim().length > 0, { message: `${label} is required` });

/** Optional schema hint: a sample document, field list or JSON schema, as text. */
const SchemaHintSchema = z.string().max(20000, "Schema is limited to 20000 characters").optional();

// ─── Requests ─────────────────────────────────────────────────────────────────

export const MongoQueryRequestSchema = z.object({
  /** Plain English description of the query. */
  prompt: nonBlank(2000, "Description"),
  collection: z.string().trim().max(120).optional(),
  schema: SchemaHintSchema,
  turnstileToken: TurnstileTokenSchema,
});
export type MongoQueryRequest = z.infer<typeof MongoQueryRequestSchema>;

export const MongoAggregationRequestSchema = MongoQueryRequestSchema;
export type MongoAggregationRequest = z.infer<typeof MongoAggregationRequestSchema>;

export const AggregationExplainRequestSchema = z.object({
  /** The pipeline as text (JSON, relaxed JSON or shell syntax). */
  pipeline: nonBlank(20000, "Pipeline"),
  turnstileToken: TurnstileTokenSchema,
});
export type AggregationExplainRequest = z.infer<typeof AggregationExplainRequestSchema>;

export const SqlToMongoRequestSchema = z.object({
  sql: nonBlank(10000, "SQL"),
  schema: SchemaHintSchema,
  turnstileToken: TurnstileTokenSchema,
});
export type SqlToMongoRequest = z.infer<typeof SqlToMongoRequestSchema>;

// ─── Responses ────────────────────────────────────────────────────────────────

/** Shared by mongodb-query, mongodb-aggregation and sql-to-mongodb. */
export const QueryToolResponseSchema = z.object({
  kind: z.enum(["find", "aggregate"]),
  collection: z.string(),
  /** find only */
  filter: z.record(z.string(), z.unknown()).optional(),
  projection: z.record(z.string(), z.unknown()).optional(),
  sort: z.record(z.string(), z.unknown()).optional(),
  limit: z.number().int().optional(),
  /** aggregate only */
  pipeline: z.array(z.record(z.string(), z.unknown())).optional(),
  explanation: z.array(z.string()),
  assumptions: z.array(z.string()),
  warnings: z.array(z.string()),
  /** true when served from the 7 day cache */
  cached: z.boolean(),
});
export type QueryToolResponse = z.infer<typeof QueryToolResponseSchema>;
export type MongoQueryResponse = QueryToolResponse;
export type MongoAggregationResponse = QueryToolResponse;
export type SqlToMongoResponse = QueryToolResponse;

export const AggregationExplainResponseSchema = z.object({
  summary: z.string(),
  stages: z.array(
    z.object({
      index: z.number().int(),
      operator: z.string(),
      plain: z.string(),
    })
  ),
  performanceNotes: z.array(z.string()),
  warnings: z.array(z.string()),
});
export type AggregationExplainResponse = z.infer<typeof AggregationExplainResponseSchema>;

// ─── Contact ──────────────────────────────────────────────────────────────────

export const ContactBodySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(LIMITS.maxNameLength),
  email: EmailSchema,
  topic: z.string().trim().min(1, "Topic is required").max(80),
  message: z
    .string()
    .trim()
    .min(1, "Message is required")
    .max(LIMITS.maxContactMessage, `Messages are limited to ${LIMITS.maxContactMessage} characters`),
  turnstileToken: TurnstileTokenSchema,
});
export type ContactBody = z.infer<typeof ContactBodySchema>;
