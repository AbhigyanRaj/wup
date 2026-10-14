import type { KnowledgeConfig, KnowledgeSourceDTO, KnowledgeStatus, KnowledgeType } from "@wup/contracts";
import { KNOWLEDGE_TYPES } from "@wup/contracts";

const STATUSES: readonly KnowledgeStatus[] = ["pending", "indexing", "indexed", "error", "error_quota"];

const iso = (v: unknown, fallback?: unknown): string => {
  for (const c of [v, fallback]) {
    if (c == null) continue;
    const d = c instanceof Date ? c : new Date(c as any);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
};

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/**
 * The legacy fields older web clients read from GET /knowledge, kept next to
 * the contract fields: `metadata.errorMessage`, `metadata.truncated`, and the
 * raw progress counters.
 */
export interface KnowledgeSourceLegacyFields {
  metadata: { errorMessage?: string; truncated: boolean };
  mimeType?: string;
  chunksDone: number;
  chunksTotal: number;
  attempts: number;
}

export type KnowledgeSourceResponse = KnowledgeSourceDTO & KnowledgeSourceLegacyFields;

/** KnowledgeSource document -> KnowledgeSourceDTO (+ legacy fields). Never exposes fileHash. */
export function toKnowledgeDTO(doc: any): KnowledgeSourceResponse {
  const d = typeof doc?.toObject === "function" ? doc.toObject() : doc ?? {};
  const id = String(d._id);
  const status: KnowledgeStatus = STATUSES.includes(d.status) ? d.status : "error";
  const type: KnowledgeType = (KNOWLEDGE_TYPES as readonly string[]).includes(d.type) ? d.type : "txt";
  const chunksDone = num(d.chunksDone);
  const chunksTotal = num(d.chunksTotal);
  const errorMessage =
    status === "error" || status === "error_quota"
      ? typeof d.metadata?.errorMessage === "string" && d.metadata.errorMessage
        ? d.metadata.errorMessage
        : "Indexing failed."
      : null;
  const truncated = d.metadata?.truncated === true;
  return {
    id,
    _id: id,
    name: typeof d.name === "string" ? d.name : "Untitled",
    type,
    status,
    fileSize: num(d.fileSize),
    chunkCount: num(d.chunkCount),
    progress: status === "pending" || status === "indexing" ? { done: chunksDone, total: chunksTotal } : null,
    errorMessage,
    truncated,
    canRetry: (status === "error" || status === "error_quota") && d.canRetry === true,
    createdAt: iso(d.createdAt, d.updatedAt),
    updatedAt: iso(d.updatedAt, d.createdAt),
    // legacy
    metadata: { ...(errorMessage ? { errorMessage } : {}), truncated },
    ...(typeof d.mimeType === "string" ? { mimeType: d.mimeType } : {}),
    chunksDone,
    chunksTotal,
    attempts: num(d.attempts),
  };
}

/** Legacy GET /knowledge/:id/status body, plus progress and canRetry. */
export function toLegacyStatus(doc: any) {
  const dto = toKnowledgeDTO(doc);
  return {
    sourceId: dto.id,
    status: dto.status,
    chunkCount: dto.chunkCount,
    name: dto.name,
    errorMessage: dto.errorMessage ?? undefined,
    truncated: dto.truncated,
    progress: dto.progress,
    canRetry: dto.canRetry,
  };
}

export function toKnowledgeConfig(cfg: {
  maxFileMb: number;
  allowedExtensions: readonly string[];
  maxSources: number;
  maxChunks: number;
}): KnowledgeConfig {
  return {
    maxFileMb: cfg.maxFileMb,
    allowedExtensions: [...cfg.allowedExtensions],
    maxSources: cfg.maxSources,
    maxChunks: cfg.maxChunks,
  };
}
