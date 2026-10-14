/**
 * Migration 005-backfill-knowledge
 *
 * Backfills KnowledgeSource progress and retry fields.
 *
 *   - status "indexed": chunksTotal = chunksDone = chunkCount where missing
 *   - attempts = 1 where missing
 *   - canRetry = false where missing (sources from before this release have no
 *     stored KnowledgeSourceText, so they cannot be retried)
 *   - sources stuck in "pending"/"indexing" for more than 15 minutes become
 *     "error" with canRetry false and metadata.errorMessage
 *     "Indexing was interrupted. Please re-upload.", and their partial chunks
 *     are removed.
 *
 * Idempotent: every write is filtered on the field being missing or the status
 * being stale, so a second run changes nothing.
 */
import { KnowledgeChunk, KnowledgeSource } from "@wup/models";

export const id = "005-backfill-knowledge";

export const STUCK_AFTER_MS = 15 * 60 * 1000;
export const INTERRUPTED_MESSAGE = "Indexing was interrupted. Please re-upload.";

type Ctx = { log?: (msg: string) => void } | undefined;

export async function up(ctx?: unknown): Promise<void> {
  const log = (ctx as Ctx)?.log ?? ((msg: string) => console.log(`[migration ${id}] ${msg}`));

  // 1. Stuck ingestions from before the queue existed: no stored text, so not
  //    retryable. Runs first so the backfills below cannot refresh updatedAt.
  const stuckFilter = {
    status: { $in: ["pending", "indexing"] },
    updatedAt: { $lt: new Date(Date.now() - STUCK_AFTER_MS) },
  };
  const stuck = await KnowledgeSource.find(stuckFilter, { _id: 1 }).lean();
  let stuckFixed = 0;
  if (stuck.length > 0) {
    const ids = stuck.map((s) => s._id);
    const r = await KnowledgeSource.updateMany(
      { ...stuckFilter, _id: { $in: ids } },
      { $set: { status: "error", canRetry: false, chunksDone: 0, "metadata.errorMessage": INTERRUPTED_MESSAGE } }
    );
    stuckFixed = r.modifiedCount;
    await KnowledgeChunk.deleteMany({ sourceId: { $in: ids } });
  }

  // 2. Indexed sources: progress counters from chunkCount (pipeline update, server side)
  const indexed = await KnowledgeSource.updateMany(
    { status: "indexed", $or: [{ chunksTotal: { $exists: false } }, { chunksDone: { $exists: false } }] },
    [{ $set: { chunksTotal: { $ifNull: ["$chunkCount", 0] }, chunksDone: { $ifNull: ["$chunkCount", 0] } } }],
    { strict: false, timestamps: false }
  );

  // 3. Defaults for the other new fields
  const attempts = await KnowledgeSource.updateMany({ attempts: { $exists: false } }, { $set: { attempts: 1 } }, { timestamps: false });
  const canRetry = await KnowledgeSource.updateMany({ canRetry: { $exists: false } }, { $set: { canRetry: false } }, { timestamps: false });
  const counters = await KnowledgeSource.updateMany(
    { status: { $ne: "indexed" }, $or: [{ chunksTotal: { $exists: false } }, { chunksDone: { $exists: false } }] },
    [{ $set: { chunksTotal: { $ifNull: ["$chunksTotal", 0] }, chunksDone: { $ifNull: ["$chunksDone", 0] } } }],
    { strict: false, timestamps: false }
  );

  log(
    `indexed progress: ${indexed.modifiedCount}, attempts: ${attempts.modifiedCount}, canRetry: ${canRetry.modifiedCount}, ` +
      `other counters: ${counters.modifiedCount}, stuck -> error: ${stuckFixed}`
  );
}

export default { id, up };
