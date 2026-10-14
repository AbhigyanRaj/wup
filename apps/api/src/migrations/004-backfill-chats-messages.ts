/**
 * Migration 004-backfill-chats-messages
 *
 * Backfills the new Chat and Message fields.
 *
 * Chats:
 *   - pinned: false where missing
 *   - titleSource: "user" where missing (existing titles were set by the client)
 *   - messageCount = count of user/assistant messages in the chat, only where missing
 *   - lastMessageAt = createdAt of the newest message when the stored value is older
 * Messages:
 *   - status "complete" and mode "chat" where missing
 *   - assistant messages: parentId = the preceding user message in the same chat, where missing
 *   - sources: legacy ragSources (kind "doc", snippet = first 300 chars of text)
 *     and webSources (kind "web", snippet null) are converted into `sources`,
 *     numbering n from 1, only when `sources` is empty. ragSources/webSources
 *     are kept for old clients.
 *
 * Idempotent: every write is filtered on the target field being absent/empty
 * (or, for lastMessageAt, older than the newest message). Writes use bulkWrite
 * in batches and every read is a cursor; no collection is loaded into memory.
 * Uses the raw collections so schema defaults never mask a missing field.
 */
import { Chat, Message } from "@wup/models";

export const id = "004-backfill-chats-messages";

const BATCH = 500;
const SNIPPET_MAX = 300;

type Log = { info?: (...a: any[]) => void };
type AnyBulkOp = Record<string, any>;

/** Buffers bulk operations and flushes them in batches. */
class BulkBuffer {
  private ops: AnyBulkOp[] = [];
  modified = 0;
  constructor(private readonly collection: { bulkWrite(ops: any[], opts?: any): Promise<any> }) {}
  async push(op: AnyBulkOp) {
    this.ops.push(op);
    if (this.ops.length >= BATCH) await this.flush();
  }
  async flush() {
    if (this.ops.length === 0) return;
    const ops = this.ops;
    this.ops = [];
    const r = await this.collection.bulkWrite(ops, { ordered: false });
    this.modified += r?.modifiedCount ?? 0;
  }
}

export async function up(ctx?: unknown): Promise<void> {
  const log: Log = ((ctx as any)?.log as Log) ?? console;
  const chats = Chat.collection;
  const messages = Message.collection;

  // ── Messages: status / mode ────────────────────────────────────────────────
  const status = await messages.updateMany({ status: { $exists: false } }, { $set: { status: "complete" } });
  const mode = await messages.updateMany({ mode: { $exists: false } }, { $set: { mode: "chat" } });

  // ── Messages: parentId for assistant messages ──────────────────────────────
  // Walk each chat in order (uses the {chatId, createdAt} index) remembering the last user message.
  const parents = new BulkBuffer(messages);
  {
    const cursor = messages
      .find({}, { projection: { chatId: 1, role: 1, parentId: 1, createdAt: 1 } })
      .sort({ chatId: 1, createdAt: 1, _id: 1 });
    let currentChat: string | null = null;
    let lastUserId: unknown = null;
    for await (const m of cursor) {
      const chatKey = String(m.chatId);
      if (chatKey !== currentChat) {
        currentChat = chatKey;
        lastUserId = null;
      }
      if (m.role === "user") {
        lastUserId = m._id;
      } else if (m.role === "assistant" && m.parentId == null && lastUserId) {
        await parents.push({ updateOne: { filter: { _id: m._id, parentId: null }, update: { $set: { parentId: lastUserId } } } });
      }
    }
    await parents.flush();
  }

  // ── Messages: sources from legacy citations ────────────────────────────────
  const sources = new BulkBuffer(messages);
  {
    const emptySources = { $or: [{ sources: { $exists: false } }, { sources: { $size: 0 } }] };
    const cursor = messages.find(
      { $and: [emptySources, { $or: [{ "ragSources.0": { $exists: true } }, { "webSources.0": { $exists: true } }] }] },
      { projection: { ragSources: 1, webSources: 1 } }
    );
    for await (const m of cursor) {
      const out: Record<string, unknown>[] = [];
      for (const r of Array.isArray(m.ragSources) ? m.ragSources : []) {
        const s: Record<string, unknown> = {
          n: out.length + 1,
          kind: "doc",
          title: typeof r?.sourceFile === "string" ? r.sourceFile : "Document",
          cited: false,
          snippet: typeof r?.text === "string" ? r.text.slice(0, SNIPPET_MAX) : "",
        };
        if (typeof r?.pageNumber === "number") s.page = r.pageNumber;
        if (typeof r?.score === "number") s.score = r.score;
        out.push(s);
      }
      for (const w of Array.isArray(m.webSources) ? m.webSources : []) {
        out.push({
          n: out.length + 1,
          kind: "web",
          title: typeof w?.title === "string" && w.title ? w.title : String(w?.url ?? ""),
          cited: false,
          url: String(w?.url ?? ""),
          snippet: null,
        });
      }
      if (out.length === 0) continue;
      await sources.push({ updateOne: { filter: { _id: m._id, ...emptySources }, update: { $set: { sources: out } } } });
    }
    await sources.flush();
  }

  // ── Chats: pinned / titleSource ────────────────────────────────────────────
  const pinned = await chats.updateMany({ pinned: { $exists: false } }, { $set: { pinned: false } });
  const titleSource = await chats.updateMany({ titleSource: { $exists: false } }, { $set: { titleSource: "user" } });

  // ── Chats: messageCount and lastMessageAt ──────────────────────────────────
  const counts = new BulkBuffer(chats);
  {
    const cursor = messages.aggregate(
      [
        { $match: { role: { $in: ["user", "assistant"] } } },
        { $group: { _id: "$chatId", count: { $sum: 1 }, lastAt: { $max: "$createdAt" } } },
      ],
      { allowDiskUse: true }
    );
    for await (const g of cursor) {
      await counts.push({
        updateOne: { filter: { _id: g._id, messageCount: { $exists: false } }, update: { $set: { messageCount: g.count } } },
      });
      if (g.lastAt) {
        await counts.push({
          updateOne: {
            filter: { _id: g._id, $or: [{ lastMessageAt: { $exists: false } }, { lastMessageAt: { $lt: g.lastAt } }] },
            update: { $set: { lastMessageAt: g.lastAt } },
          },
        });
      }
    }
    await counts.flush();
  }
  // Chats with no messages at all
  const zero = await chats.updateMany({ messageCount: { $exists: false } }, { $set: { messageCount: 0 } });

  log.info?.(
    `[${id}] messages: status ${status.modifiedCount}, mode ${mode.modifiedCount}, parentId ${parents.modified}, sources ${sources.modified}; ` +
      `chats: pinned ${pinned.modifiedCount}, titleSource ${titleSource.modifiedCount}, counts/lastMessageAt ${counts.modified + zero.modifiedCount}`
  );
}

export default { id, up };
