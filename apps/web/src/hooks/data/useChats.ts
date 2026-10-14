"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import {
  flattenChats,
  patchChatInList,
  useChatList,
  useDeleteChat,
  useUpdateChat as useUpdateChatMeta,
  type ChatsList,
} from "@/components/app/chat-cache";
import type { ChatSummary, CreateChatBody } from "@/lib/types";

/*
 * Chats. The sidebar list and its rename / pin / delete mutations are APP-1's
 * (components/app/chat-cache.ts); they are re-exported here so chat code has
 * one import. This file adds what the chat screen needs on top:
 *   useChat(id)          qk.chats.detail(id), seeded from the list
 *   createChat(body)     POST /chats
 *   useUpdateChatScope() PATCH /chats/:id {bridgeIds}, optimistic
 */

export { useChatList as useChats, flattenChats, useDeleteChat, useUpdateChatMeta };

function normalizeChat(c: ChatSummary): ChatSummary {
  const id = c.id ?? c._id;
  return {
    ...c,
    id,
    _id: c._id ?? id,
    title: c.title || "New chat",
    titleSource: c.titleSource ?? "auto",
    pinned: !!c.pinned,
    bridgeIds: c.bridgeIds ?? [],
    messageCount: c.messageCount ?? 0,
    lastMessageAt: c.lastMessageAt ?? c.createdAt,
  };
}

export function findChatInList(data: ChatsList | undefined, id: string): ChatSummary | undefined {
  for (const p of data?.pages ?? []) {
    const hit = p.items.find((c) => c.id === id);
    if (hit) return hit;
  }
  return undefined;
}

export function useChat(chatId: string | null) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: qk.chats.detail(chatId ?? "none"),
    queryFn: ({ signal }) =>
      api<ChatSummary>(`/chats/${encodeURIComponent(chatId as string)}`, { signal }).then(normalizeChat),
    enabled: !!chatId,
    initialData: () => (chatId ? findChatInList(qc.getQueryData<ChatsList>(qk.chats.list), chatId) : undefined),
    initialDataUpdatedAt: () => qc.getQueryState(qk.chats.list)?.dataUpdatedAt,
    staleTime: 30_000,
    retry: (count, err) => (err as { status?: number })?.status !== 404 && count < 2,
  });
}

export function createChat(body: CreateChatBody) {
  return api<ChatSummary>("/chats", { method: "POST", json: body }).then(normalizeChat);
}

/** PATCH /chats/:id {bridgeIds}, applied optimistically. */
export function useUpdateChatScope() {
  const qc = useQueryClient();
  return useMutation({
    meta: { errorMessage: "Couldn't change the data scope. Try again." },
    mutationFn: ({ id, bridgeIds }: { id: string; bridgeIds: string[] }) =>
      api<ChatSummary>(`/chats/${encodeURIComponent(id)}`, { method: "PATCH", json: { bridgeIds } }),
    onMutate: async ({ id, bridgeIds }) => {
      await qc.cancelQueries({ queryKey: qk.chats.detail(id) });
      const detail = qc.getQueryData<ChatSummary>(qk.chats.detail(id));
      patchChatInList(qc, id, { bridgeIds });
      return { detail };
    },
    onError: (_e, { id }, ctx) => {
      if (ctx?.detail) patchChatInList(qc, id, { bridgeIds: ctx.detail.bridgeIds });
    },
  });
}
