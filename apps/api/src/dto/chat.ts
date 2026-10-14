import type { ChatSummary } from "@wup/contracts";
import { plain } from "./message";

export const DEFAULT_CHAT_TITLE = "New chat";
/** Titles that mean "nobody named this chat yet". */
export const DEFAULT_CHAT_TITLES = [DEFAULT_CHAT_TITLE, "Untitled chat", "New Chat", "Untitled"];

export function isDefaultTitle(title: unknown): boolean {
  return typeof title !== "string" || title.trim() === "" || DEFAULT_CHAT_TITLES.includes(title.trim());
}

const iso = (v: unknown, fallback?: unknown): string => {
  for (const c of [v, fallback]) {
    if (c == null) continue;
    const d = c instanceof Date ? c : new Date(c as any);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
};

/** Chat document -> ChatSummary (with the deprecated `_id` alias for old clients). */
export function toChatSummary(doc: any, match?: ChatSummary["match"]): ChatSummary {
  const d = plain(doc) ?? {};
  const id = String(d._id);
  return {
    id,
    _id: id,
    title: typeof d.title === "string" && d.title.trim() ? d.title : DEFAULT_CHAT_TITLE,
    titleSource: d.titleSource === "auto" ? "auto" : "user",
    pinned: d.pinned === true,
    bridgeIds: (Array.isArray(d.bridgeIds) ? d.bridgeIds : []).map((b: unknown) => String(b)),
    messageCount: typeof d.messageCount === "number" ? d.messageCount : 0,
    lastMessageAt: iso(d.lastMessageAt, d.createdAt),
    createdAt: iso(d.createdAt, d.lastMessageAt),
    ...(match ? { match } : {}),
  };
}
