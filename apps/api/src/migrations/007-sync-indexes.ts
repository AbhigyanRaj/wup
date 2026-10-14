/**
 * Migration 007-sync-indexes
 *
 * Brings indexes in line with the models by calling Model.syncIndexes() for:
 *   User, Chat, Message, Connection, KnowledgeSource, KnowledgeChunk,
 *   KnowledgeSourceText, UsageDaily, Migration, Waitlist, PublicToolUsage,
 *   PublicToolCache, ContactMessage.
 * Notes:
 *   - A collection can have only one text index. Before syncing a model that
 *     declares one (Message: { userId: 1, content: "text" }), any other text
 *     index on that collection is dropped.
 *   - User TTL { purgeAt: 1 } is partial on { isDemo: true }; real users are never TTL'd.
 *   - Atlas Search / vector search indexes (knowledgechunks) are not regular
 *     indexes and are invisible to syncIndexes, so they are left alone.
 * Each model is synced independently: a failure is logged and the rest continue.
 * Run after 003 (the unique email index must not see case-only duplicates) and
 * after 004/005 so backfilled fields are indexed. Idempotent by nature.
 */
import * as models from "@wup/models";

export const id = "007-sync-indexes";

type Ctx = { log?: { info?: (...a: any[]) => void; warn?: (...a: any[]) => void; error?: (...a: any[]) => void } } | undefined;

export const MODEL_NAMES = [
  "User",
  "Chat",
  "Message",
  "Connection",
  "KnowledgeSource",
  "KnowledgeChunk",
  "KnowledgeSourceText",
  "UsageDaily",
  "Migration",
  "Waitlist",
  "PublicToolUsage",
  "PublicToolCache",
  "ContactMessage",
] as const;

const isTextIndex = (key: Record<string, unknown>) =>
  Object.values(key).some((v) => v === "text") || "_fts" in key;

const sameKey = (a: Record<string, unknown>, b: Record<string, unknown>) => {
  // Text indexes are stored as { _fts: "text", _ftsx: 1, ...prefix }; compare on the non-text prefix + fields.
  const norm = (k: Record<string, unknown>) =>
    JSON.stringify(Object.entries(k).filter(([f, v]) => v !== "text" && f !== "_fts" && f !== "_ftsx"));
  return norm(a) === norm(b);
};

/** Drops text indexes that differ from the model's own (at most one text index per collection). */
async function dropForeignTextIndexes(model: any, log: NonNullable<Ctx>["log"]): Promise<void> {
  const declared = (model.schema.indexes() as Array<[Record<string, unknown>, Record<string, unknown>]>).find(([key]) =>
    isTextIndex(key)
  );
  if (!declared) return;

  let existing: any[] = [];
  try {
    existing = await model.collection.indexes();
  } catch {
    return; // collection does not exist yet
  }
  const declaredFields = Object.keys(declared[0]).filter((f) => declared[0][f] === "text").sort();
  for (const idx of existing) {
    if (!isTextIndex(idx.key)) continue;
    const fields = Object.keys(idx.weights ?? {}).sort();
    const matches = sameKey(idx.key, declared[0]) && JSON.stringify(fields) === JSON.stringify(declaredFields);
    if (!matches) {
      await model.collection.dropIndex(idx.name);
      log?.info?.(`[${id}] ${model.modelName}: dropped text index ${idx.name}`);
    }
  }
}

export async function up(ctx?: unknown): Promise<void> {
  const log = (ctx as Ctx)?.log ?? console;
  for (const name of MODEL_NAMES) {
    const model: any = (models as any)[name];
    if (!model?.syncIndexes) {
      log.warn?.(`[${id}] ${name}: model not found, skipped`);
      continue;
    }
    try {
      await dropForeignTextIndexes(model, log);
      const dropped: string[] = await model.syncIndexes();
      log.info?.(`[${id}] ${name}: indexes synced${dropped?.length ? `, dropped ${dropped.join(", ")}` : ""}`);
    } catch (err: any) {
      // Log and continue: one bad index (e.g. duplicates under a new unique key) must not block the rest.
      log.error?.(`[${id}] ${name}: index sync failed: ${err?.message ?? err}`);
    }
  }
}

export default { id, up };
