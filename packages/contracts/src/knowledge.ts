import { z } from "zod";
import { ISODateSchema, IdSchema } from "./common";

export const KNOWLEDGE_TYPES = ["pdf", "txt", "md", "csv", "docx"] as const;
export const KnowledgeTypeSchema = z.enum(KNOWLEDGE_TYPES);
export type KnowledgeType = z.infer<typeof KnowledgeTypeSchema>;

/**
 * pending     created, not started
 * indexing    ingestion running
 * indexed     ready for retrieval
 * error       ingestion failed (see errorMessage)
 * error_quota embedding quota exhausted mid-ingestion
 */
export const KnowledgeStatusSchema = z.enum(["pending", "indexing", "indexed", "error", "error_quota"]);
export type KnowledgeStatus = z.infer<typeof KnowledgeStatusSchema>;

export const KnowledgeSourceDTOSchema = z.object({
  id: IdSchema,
  /** @deprecated alias of id, kept for older clients */
  _id: IdSchema,
  name: z.string(),
  type: KnowledgeTypeSchema,
  status: KnowledgeStatusSchema,
  /** bytes */
  fileSize: z.number(),
  chunkCount: z.number(),
  /** Chunks embedded so far, while indexing. */
  progress: z.object({ done: z.number(), total: z.number() }).nullable(),
  errorMessage: z.string().nullable(),
  /** true when the per-user chunk cap cut the document short. */
  truncated: z.boolean(),
  canRetry: z.boolean(),
  createdAt: ISODateSchema,
  updatedAt: ISODateSchema,
});
export type KnowledgeSourceDTO = z.infer<typeof KnowledgeSourceDTOSchema>;

export const UploadResponseSchema = z.object({
  source: KnowledgeSourceDTOSchema,
  /** @deprecated use source.id */
  sourceId: IdSchema,
  /** @deprecated use source.name */
  name: z.string(),
  /** @deprecated use source.status */
  status: KnowledgeStatusSchema,
  message: z.string().optional(),
});
export type UploadResponse = z.infer<typeof UploadResponseSchema>;

export const KnowledgeConfigSchema = z.object({
  maxFileMb: z.number(),
  /** Lowercase extensions with a leading dot, e.g. ".pdf". */
  allowedExtensions: z.array(z.string()),
  maxSources: z.number(),
  maxChunks: z.number(),
});
export type KnowledgeConfig = z.infer<typeof KnowledgeConfigSchema>;

/** Maps a file extension (with or without the dot) to its KnowledgeType. */
export function knowledgeTypeFromExtension(ext: string): KnowledgeType | null {
  const e = ext.toLowerCase().replace(/^\./, "");
  if (e === "markdown") return "md";
  return (KNOWLEDGE_TYPES as readonly string[]).includes(e) ? (e as KnowledgeType) : null;
}
