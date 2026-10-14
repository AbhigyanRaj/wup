import mongoose from "mongoose";
import type { ChatSummary, ListChatsQuery, Page } from "@wup/contracts";
import { Chat, Message } from "@wup/models";
import { toChatSummary } from "../../dto/chat";
import { asyncHandler, getUserId, httpError, validatedQuery } from "./deps";

/**
 * GET /chats?q&limit&cursor
 *
 *  - q:              search (titles + message text), returns Page<ChatSummary> with `match`
 *  - limit / cursor: cursor pagination, returns Page<ChatSummary>
 *  - neither:        LEGACY plain ChatSummary[] (the pre-v2 client expects an array)
 *
 * Order: pinned first, then most recent activity, then _id (stable).
 */

export const DEFAULT_PAGE_SIZE = 30;
export const MAX_SEARCH_RESULTS = 20;
const SNIPPET_RADIUS = 60;
const SORT = { pinned: -1, lastMessageAt: -1, _id: -1 } as const;

interface Cursor {
  p: boolean;
  t: string;
  id: string;
}

export function encodeCursor(doc: any): string {
  const c: Cursor = { p: doc.pinned === true, t: new Date(doc.lastMessageAt ?? 0).toISOString(), id: String(doc._id) };
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url");
}

export function decodeCursor(raw: string): Cursor {
  const invalid = () => httpError(400, "VALIDATION_FAILED", "Invalid cursor", { details: [{ path: "cursor", message: "Invalid cursor" }] });
  let c: any;
  try {
    c = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    throw invalid();
  }
  if (!c || typeof c.p !== "boolean" || typeof c.t !== "string" || !mongoose.isValidObjectId(c.id) || Number.isNaN(Date.parse(c.t))) {
    throw invalid();
  }
  return c as Cursor;
}

/** Everything strictly after the cursor in SORT order. */
function afterCursor(c: Cursor): Record<string, unknown> {
  const t = new Date(c.t);
  const id = new mongoose.Types.ObjectId(c.id);
  const sameGroup = c.p ? { pinned: true } : { pinned: { $ne: true } };
  const or: Record<string, unknown>[] = [
    { ...sameGroup, lastMessageAt: { $lt: t } },
    { ...sameGroup, lastMessageAt: t, _id: { $lt: id } },
  ];
  if (c.p) or.push({ pinned: { $ne: true } });
  return { $or: or };
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A short excerpt of `content` around the first query term. */
export function makeSnippet(content: string, q: string): string {
  const text = content.replace(/\s+/g, " ").trim();
  const lower = text.toLowerCase();
  const terms = [q, ...q.split(/\s+/)].map((t) => t.trim().toLowerCase()).filter(Boolean);
  let at = -1;
  for (const term of terms) {
    at = lower.indexOf(term);
    if (at >= 0) break;
  }
  if (at < 0) return text.slice(0, SNIPPET_RADIUS * 2) + (text.length > SNIPPET_RADIUS * 2 ? "..." : "");
  const start = Math.max(0, at - SNIPPET_RADIUS);
  const end = Math.min(text.length, at + SNIPPET_RADIUS);
  return `${start > 0 ? "..." : ""}${text.slice(start, end)}${end < text.length ? "..." : ""}`;
}

async function searchChats(userId: string, q: string): Promise<ChatSummary[]> {
  const uid = new mongoose.Types.ObjectId(userId);
  const titleMatches: any[] = await Chat.find({ userId: uid, title: { $regex: escapeRegex(q), $options: "i" } })
    .sort(SORT)
    .limit(MAX_SEARCH_RESULTS)
    .lean();

  // Message text: $text needs the {userId, content:"text"} index; fall back to a regex scan.
  let messageHits: any[];
  try {
    messageHits = await Message.find(
      { userId: uid, $text: { $search: q } },
      { score: { $meta: "textScore" }, chatId: 1, content: 1 }
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(200)
      .lean();
  } catch {
    messageHits = await Message.find({ userId: uid, content: { $regex: escapeRegex(q), $options: "i" } })
      .select("chatId content")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
  }

  const firstHitByChat = new Map<string, any>();
  for (const m of messageHits) {
    const key = String(m.chatId);
    if (!firstHitByChat.has(key)) firstHitByChat.set(key, m);
  }

  const out: ChatSummary[] = [];
  const seen = new Set<string>();
  for (const chat of titleMatches) {
    const key = String(chat._id);
    seen.add(key);
    const hit = firstHitByChat.get(key);
    out.push(
      toChatSummary(chat, hit ? { messageId: String(hit._id), snippet: makeSnippet(hit.content ?? "", q) } : { messageId: null, snippet: chat.title })
    );
  }

  const remainingIds = [...firstHitByChat.keys()].filter((id) => !seen.has(id)).slice(0, MAX_SEARCH_RESULTS);
  if (remainingIds.length && out.length < MAX_SEARCH_RESULTS) {
    const chats: any[] = await Chat.find({ _id: { $in: remainingIds }, userId: uid }).lean();
    const byId = new Map(chats.map((c) => [String(c._id), c]));
    for (const id of remainingIds) {
      const chat = byId.get(id);
      if (!chat) continue;
      const hit = firstHitByChat.get(id);
      out.push(toChatSummary(chat, { messageId: String(hit._id), snippet: makeSnippet(hit.content ?? "", q) }));
      if (out.length >= MAX_SEARCH_RESULTS) break;
    }
  }
  return out.slice(0, MAX_SEARCH_RESULTS);
}

export const listChats = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const query = validatedQuery<ListChatsQuery>(req);
  const q = query.q?.trim();

  if (q) {
    const page: Page<ChatSummary> = { items: await searchChats(userId, q), nextCursor: null };
    return res.json(page);
  }

  if (query.limit === undefined && query.cursor === undefined) {
    const all = await Chat.find({ userId }).sort(SORT).lean();
    return res.json(all.map((c) => toChatSummary(c)));
  }

  const limit = query.limit ?? DEFAULT_PAGE_SIZE;
  const filter: Record<string, unknown> = { userId };
  if (query.cursor) Object.assign(filter, afterCursor(decodeCursor(query.cursor)));
  const docs: any[] = await Chat.find(filter).sort(SORT).limit(limit + 1).lean();
  const hasMore = docs.length > limit;
  const items = docs.slice(0, limit);
  const page: Page<ChatSummary> = {
    items: items.map((c) => toChatSummary(c)),
    nextCursor: hasMore ? encodeCursor(items[items.length - 1]) : null,
  };
  res.json(page);
});
