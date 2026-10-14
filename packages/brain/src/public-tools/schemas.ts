/**
 * Output schemas for the free public tools (marketing site, no account).
 *
 * The model returns query parts as JSON strings (MongoDB Extended JSON for
 * dates and ids), because Gemini response schemas cannot describe free-form
 * objects. They are parsed and checked here before anything leaves the server.
 */
import { SchemaType, type ResponseSchema } from "@google/generative-ai";
import { z } from "zod";

const shortList = z.array(z.string().max(600)).max(10);

/** Raw model output for mongodb-query, mongodb-aggregation and sql-to-mongodb. */
export const RawQueryOutputSchema = z.object({
  kind: z.enum(["find", "aggregate"]),
  collection: z.string().max(120),
  /** find only: JSON object text */
  filterJson: z.string().max(20000).optional(),
  projectionJson: z.string().max(5000).optional(),
  sortJson: z.string().max(2000).optional(),
  limit: z.number().int().min(0).max(10000).optional(),
  /** aggregate only: JSON array text */
  pipelineJson: z.string().max(40000).optional(),
  explanation: shortList,
  assumptions: shortList,
  warnings: shortList,
});
export type RawQueryOutput = z.infer<typeof RawQueryOutputSchema>;

/** Parsed and checked query, ready to return (without the `cached` flag). */
export interface GeneratedQuery {
  kind: "find" | "aggregate";
  collection: string;
  filter?: Record<string, unknown>;
  projection?: Record<string, unknown>;
  sort?: Record<string, unknown>;
  limit?: number;
  pipeline?: Array<Record<string, unknown>>;
  explanation: string[];
  assumptions: string[];
  warnings: string[];
}

export const RawExplainOutputSchema = z.object({
  summary: z.string().max(2000),
  stages: z
    .array(
      z.object({
        index: z.number().int().min(0),
        operator: z.string().max(60),
        plain: z.string().max(1200),
      })
    )
    .max(40),
  performanceNotes: shortList,
  warnings: shortList,
});
export type GeneratedExplanation = z.infer<typeof RawExplainOutputSchema>;

const stringList: ResponseSchema = { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } };

/** Gemini responseSchema matching RawQueryOutputSchema. */
export const QUERY_RESPONSE_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    kind: { type: SchemaType.STRING, format: "enum", enum: ["find", "aggregate"] },
    collection: { type: SchemaType.STRING },
    filterJson: { type: SchemaType.STRING, description: "find filter as a JSON object string, '{}' to match all" },
    projectionJson: { type: SchemaType.STRING, description: "find projection as a JSON object string, or omit" },
    sortJson: { type: SchemaType.STRING, description: "find sort as a JSON object string, or omit" },
    limit: { type: SchemaType.INTEGER },
    pipelineJson: { type: SchemaType.STRING, description: "aggregation pipeline as a JSON array string" },
    explanation: stringList,
    assumptions: stringList,
    warnings: stringList,
  },
  required: ["kind", "collection", "explanation", "assumptions", "warnings"],
};

/** Gemini responseSchema matching RawExplainOutputSchema. */
export const EXPLAIN_RESPONSE_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    summary: { type: SchemaType.STRING },
    stages: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          index: { type: SchemaType.INTEGER },
          operator: { type: SchemaType.STRING },
          plain: { type: SchemaType.STRING },
        },
        required: ["index", "operator", "plain"],
      },
    },
    performanceNotes: stringList,
    warnings: stringList,
  },
  required: ["summary", "stages", "performanceNotes", "warnings"],
};
