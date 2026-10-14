/**
 * Knowledge base (uploaded documents): API client and status helpers.
 */

import type { KnowledgeConfig, KnowledgeSourceDTO, KnowledgeStatus } from "@/lib/types";
import { api } from "@/lib/api";

export type { KnowledgeConfig, KnowledgeSourceDTO, KnowledgeStatus };

type Loose = Record<string, unknown>;

/** Accepts the contract shape and the older `{_id, metadata: {errorMessage}}` shape. */
export function normalizeSource(raw: KnowledgeSourceDTO): KnowledgeSourceDTO {
  const r = raw as KnowledgeSourceDTO & Loose;
  const meta = (r.metadata ?? {}) as Loose;
  const id = String(r.id ?? r._id);
  const status = (r.status ?? "pending") as KnowledgeStatus;
  return {
    ...r,
    id,
    _id: id,
    type: r.type ?? (r.name?.split(".").pop()?.toLowerCase() as KnowledgeSourceDTO["type"]) ?? "pdf",
    status,
    fileSize: Number(r.fileSize ?? 0),
    chunkCount: Number(r.chunkCount ?? 0),
    progress: r.progress ?? null,
    errorMessage: (r.errorMessage ?? (meta.errorMessage as string | undefined) ?? null) as string | null,
    truncated: Boolean(r.truncated ?? meta.truncated),
    canRetry: r.canRetry ?? (status === "error" || status === "error_quota"),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt ?? r.createdAt,
  };
}

/** Fallback when GET /knowledge/config is unavailable. */
export const DEFAULT_KNOWLEDGE_CONFIG: KnowledgeConfig = {
  maxFileMb: 20,
  allowedExtensions: [".pdf", ".txt", ".md", ".csv", ".docx"],
  maxSources: 50,
  maxChunks: 5000,
};

export const knowledgeApi = {
  list: async (signal?: AbortSignal) => {
    const res = await api<KnowledgeSourceDTO[] | { items: KnowledgeSourceDTO[] }>("/knowledge", { signal });
    const items = Array.isArray(res) ? res : (res?.items ?? []);
    return items.map(normalizeSource);
  },
  get: async (id: string, signal?: AbortSignal) =>
    normalizeSource(await api<KnowledgeSourceDTO>(`/knowledge/${id}`, { signal })),
  config: (signal?: AbortSignal) => api<KnowledgeConfig>("/knowledge/config", { signal }),
  remove: (id: string) => api<{ message?: string }>(`/knowledge/${id}`, { method: "DELETE" }),
  retry: async (id: string) => {
    const res = await api<KnowledgeSourceDTO | { source: KnowledgeSourceDTO }>(`/knowledge/${id}/retry`, {
      method: "POST",
    });
    const src = res && "source" in res ? res.source : res;
    return src && (src as Loose).name ? normalizeSource(src as KnowledgeSourceDTO) : null;
  },
};

/* -------------------------------------------------------------------------- */
/* Status mapping                                                              */
/* -------------------------------------------------------------------------- */

/** UI phase for a stored source. pending and indexing are never "failed". */
export type SourcePhase = "indexing" | "ready" | "failed";

export function phaseFor(status: KnowledgeStatus): SourcePhase {
  switch (status) {
    case "indexed":
      return "ready";
    case "error":
    case "error_quota":
      return "failed";
    case "pending":
    case "indexing":
    default:
      return "indexing";
  }
}

export function isInFlight(s: Pick<KnowledgeSourceDTO, "status">): boolean {
  return s.status === "pending" || s.status === "indexing";
}

/** "Indexing 12 of 40 chunks" (or a plain label before the total is known). */
export function indexingLabel(progress: KnowledgeSourceDTO["progress"], withUnit = true): string {
  if (progress && progress.total > 0) {
    return `Indexing ${progress.done.toLocaleString("en-US")} of ${progress.total.toLocaleString("en-US")}${withUnit ? " chunks" : ""}`;
  }
  return "Indexing";
}

export function failureMessage(s: Pick<KnowledgeSourceDTO, "status" | "errorMessage">): string {
  if (s.status === "error_quota") return s.errorMessage || "The embedding quota ran out while indexing. Retry later.";
  return s.errorMessage || "We couldn't index this file.";
}

/* -------------------------------------------------------------------------- */
/* Files                                                                       */
/* -------------------------------------------------------------------------- */

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MIME_BY_EXT: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".txt": ["text/plain"],
  ".md": ["text/markdown", "text/x-markdown"],
  ".markdown": ["text/markdown", "text/x-markdown"],
  ".csv": ["text/csv", "application/vnd.ms-excel"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
};

const LABEL_BY_EXT: Record<string, string> = {
  ".pdf": "PDF",
  ".txt": "TXT",
  ".md": "Markdown",
  ".markdown": "Markdown",
  ".csv": "CSV",
  ".docx": "Word",
};

export function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

/** `accept` attribute value: extensions plus their MIME types. */
export function acceptAttr(cfg: KnowledgeConfig): string {
  const exts = [...cfg.allowedExtensions];
  if (exts.includes(".md") && !exts.includes(".markdown")) exts.push(".markdown");
  const mimes = exts.flatMap((e) => MIME_BY_EXT[e] ?? []);
  return [...new Set([...exts, ...mimes])].join(",");
}

/** "PDF, TXT, Markdown, CSV or Word" */
export function formatsLabel(cfg: KnowledgeConfig): string {
  const labels = [...new Set(cfg.allowedExtensions.map((e) => LABEL_BY_EXT[e] ?? e.replace(/^\./, "").toUpperCase()))];
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`;
}

/** Returns an error message when the file can't be uploaded, or null. */
export function validateFile(file: File, cfg: KnowledgeConfig): string | null {
  const ext = extensionOf(file.name);
  const allowed = new Set(cfg.allowedExtensions.map((e) => e.toLowerCase()));
  if (allowed.has(".md")) allowed.add(".markdown");
  const mimeOk = file.type ? Object.entries(MIME_BY_EXT).some(([e, m]) => allowed.has(e) && m.includes(file.type)) : false;
  if (!allowed.has(ext) && !(ext === "" && mimeOk)) {
    return `${formatsLabel(cfg)} files only.`;
  }
  if (file.size > cfg.maxFileMb * 1024 * 1024) return `This file is larger than ${cfg.maxFileMb} MB.`;
  if (file.size === 0) return "This file is empty.";
  return null;
}
