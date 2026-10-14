"use client";

/*
 * Sidebar chat list: GET /chats?limit=30&cursor (infinite) plus optimistic
 * rename / pin / delete. Cache shape under qk.chats.list:
 *   InfiniteData<Page<ChatSummary>, string | null>
 * (the same shape APP-2's stream store writes to).
 */
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { ChatSummary, Page } from "@/lib/types";
import { toast } from "@/components/ui/toast";

export type ChatsList = InfiniteData<Page<ChatSummary>, string | null>;

export const CHAT_PAGE_SIZE = 30;

/** Accepts both the paginated shape and the legacy plain array. */
export function toChatPage(body: Page<ChatSummary> | ChatSummary[] | undefined): Page<ChatSummary> {
  if (!body) return { items: [], nextCursor: null };
  if (Array.isArray(body)) return { items: body.map(normalizeChat), nextCursor: null };
  return { items: (body.items ?? []).map(normalizeChat), nextCursor: body.nextCursor ?? null };
}

function normalizeChat(c: ChatSummary): ChatSummary {
  const id = c.id ?? c._id;
  return {
    ...c,
    id,
    _id: c._id ?? id,
    title: c.title || "New chat",
    pinned: !!c.pinned,
    lastMessageAt: c.lastMessageAt ?? c.createdAt,
  };
}

export function fetchChatPage(cursor: string | null, signal?: AbortSignal) {
  return api<Page<ChatSummary> | ChatSummary[]>("/chats", {
    signal,
    query: { limit: CHAT_PAGE_SIZE, cursor },
  }).then(toChatPage);
}

export function useChatList() {
  return useInfiniteQuery({
    queryKey: qk.chats.list,
    queryFn: ({ pageParam, signal }) => fetchChatPage(pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
}

/** All chats currently cached in the sidebar list (flattened, deduped). */
export function flattenChats(data: { pages: Page<ChatSummary>[] } | undefined): ChatSummary[] {
  if (!data?.pages) return [];
  const seen = new Set<string>();
  const out: ChatSummary[] = [];
  for (const p of data.pages) {
    for (const c of p.items) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(c);
    }
  }
  return out;
}

// ─── Cache helpers (exported for other agents) ──────────────────────────────

export function patchChatInList(qc: QueryClient, id: string, patch: Partial<ChatSummary>) {
  qc.setQueryData<ChatsList>(qk.chats.list, (old) =>
    old?.pages
      ? {
          ...old,
          pages: old.pages.map((p) => ({
            ...p,
            items: p.items.map((c) => (c.id === id ? { ...c, ...patch } : c)),
          })),
        }
      : old,
  );
  qc.setQueryData<ChatSummary>(qk.chats.detail(id), (old) => (old ? { ...old, ...patch } : old));
}

export function removeChatFromList(qc: QueryClient, id: string) {
  qc.setQueryData<ChatsList>(qk.chats.list, (old) =>
    old?.pages
      ? { ...old, pages: old.pages.map((p) => ({ ...p, items: p.items.filter((c) => c.id !== id) })) }
      : old,
  );
}

// ─── Mutations ──────────────────────────────────────────────────────────────

type Snapshot = { list?: ChatsList; detail?: ChatSummary };

async function snapshot(qc: QueryClient, id: string): Promise<Snapshot> {
  await qc.cancelQueries({ queryKey: qk.chats.list });
  return {
    list: qc.getQueryData<ChatsList>(qk.chats.list),
    detail: qc.getQueryData<ChatSummary>(qk.chats.detail(id)),
  };
}

function restore(qc: QueryClient, id: string, snap: Snapshot | undefined) {
  if (!snap) return;
  qc.setQueryData(qk.chats.list, snap.list);
  if (snap.detail) qc.setQueryData(qk.chats.detail(id), snap.detail);
}

export function useUpdateChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { title?: string; pinned?: boolean } }) =>
      api<ChatSummary>(`/chats/${id}`, { method: "PATCH", json: patch }),
    onMutate: async ({ id, patch }) => {
      const snap = await snapshot(qc, id);
      patchChatInList(qc, id, { ...patch, ...(patch.title ? { titleSource: "user" as const } : {}) });
      return snap;
    },
    onError: (_e, { id, patch }, snap) => {
      restore(qc, id, snap);
      toast.error(
        patch.title !== undefined
          ? "Couldn't rename the chat. Try again."
          : patch.pinned
            ? "Couldn't pin the chat. Try again."
            : "Couldn't unpin the chat. Try again.",
      );
    },
    meta: { silent: true },
  });
}

export function useDeleteChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/chats/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      const snap = await snapshot(qc, id);
      removeChatFromList(qc, id);
      return snap;
    },
    onError: (_e, id, snap) => {
      restore(qc, id, snap);
      toast.error("Couldn't delete the chat. Try again.");
    },
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: qk.chats.detail(id) });
      qc.removeQueries({ queryKey: qk.messages(id) });
      void qc.invalidateQueries({ queryKey: qk.usage });
      toast.success("Chat deleted");
    },
    meta: { silent: true },
  });
}

// ─── Grouping ───────────────────────────────────────────────────────────────

export type ChatGroupKey = "pinned" | "today" | "yesterday" | "week" | "older";

export const CHAT_GROUP_LABEL: Record<ChatGroupKey, string> = {
  pinned: "Pinned",
  today: "Today",
  yesterday: "Yesterday",
  week: "Previous 7 days",
  older: "Older",
};

export function groupChats(chats: ChatSummary[], now = new Date()) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 86_400_000;
  const groups: Record<ChatGroupKey, ChatSummary[]> = { pinned: [], today: [], yesterday: [], week: [], older: [] };
  const sorted = [...chats].sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
  );
  for (const c of sorted) {
    if (c.pinned) {
      groups.pinned.push(c);
      continue;
    }
    const t = new Date(c.lastMessageAt).getTime();
    if (t >= startOfToday) groups.today.push(c);
    else if (t >= startOfToday - day) groups.yesterday.push(c);
    else if (t >= startOfToday - 7 * day) groups.week.push(c);
    else groups.older.push(c);
  }
  return (Object.keys(groups) as ChatGroupKey[])
    .filter((k) => groups[k].length > 0)
    .map((k) => ({ key: k, label: CHAT_GROUP_LABEL[k], chats: groups[k] }));
}
