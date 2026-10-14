import { Connection, KnowledgeSource } from "@wup/models";
import { safeRetrieve, type RetrievedChunk } from "../rag/retriever";
import { log } from "../ai/common";

/**
 * Loads everything one answer needs before the LLM call. RAG retrieval and the
 * bridge lookup run in parallel; a failure in either degrades to "none".
 */

export interface LoadedContext {
  chunks: RetrievedChunk[];
  /** The chat's bridges, without their encrypted config. */
  connections: any[];
  /** Up to 20 indexed document names for AVAILABLE DATA. */
  knowledgeNames: string[];
}

export interface ContextRequest {
  userId: string;
  prompt: string;
  bridgeIds?: string[];
  /** The user's own Gemini key, used for the query embedding. */
  ragApiKey?: string;
  signal?: AbortSignal;
}

export interface ContextLoader {
  retrieve(userId: string, query: string, opts: { signal?: AbortSignal; apiKey?: string }): Promise<RetrievedChunk[]>;
  loadBridges(userId: string, bridgeIds?: string[]): Promise<any[]>;
  loadKnowledgeNames(userId: string): Promise<string[]>;
}

const KNOWLEDGE_NAMES_TIMEOUT_MS = 1500;

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    p.catch(() => fallback),
    new Promise<T>((resolve) => {
      timer = setTimeout(() => resolve(fallback), ms);
      (timer as any).unref?.();
    }),
  ]).finally(() => timer && clearTimeout(timer));
}

export const defaultContextLoader: ContextLoader = {
  retrieve: (userId, query, opts) => safeRetrieve(userId, query, { signal: opts.signal, apiKey: opts.apiKey }),

  async loadBridges(userId, bridgeIds) {
    const filter: Record<string, unknown> = { userId };
    if (bridgeIds && bridgeIds.length > 0) filter._id = { $in: bridgeIds };
    return (Connection as any).find(filter).select("-config").lean();
  },

  async loadKnowledgeNames(userId) {
    const docs: any[] = await withTimeout(
      (KnowledgeSource as any)
        .find({ userId, status: "indexed" })
        .select("name")
        .sort({ createdAt: -1 })
        .limit(20)
        .lean()
        .exec(),
      KNOWLEDGE_NAMES_TIMEOUT_MS,
      []
    );
    return (docs ?? []).map((d) => String(d?.name ?? "")).filter(Boolean);
  },
};

export async function loadContext(req: ContextRequest, loader: ContextLoader = defaultContextLoader): Promise<LoadedContext> {
  const [chunks, connections, knowledgeNames] = await Promise.all([
    loader.retrieve(req.userId, req.prompt, { signal: req.signal, apiKey: req.ragApiKey }).catch((err) => {
      log().warn("rag retrieval failed", { message: err?.message });
      return [] as RetrievedChunk[];
    }),
    loader.loadBridges(req.userId, req.bridgeIds).catch((err) => {
      log().warn("loading bridges failed", { message: err?.message });
      return [] as any[];
    }),
    loader.loadKnowledgeNames(req.userId).catch(() => [] as string[]),
  ]);
  return { chunks: chunks ?? [], connections: connections ?? [], knowledgeNames: knowledgeNames ?? [] };
}

export const isMongoBridge = (c: any) => c?.type === "mongodb";
export const isSheetsBridge = (c: any) => c?.type === "sheets";
