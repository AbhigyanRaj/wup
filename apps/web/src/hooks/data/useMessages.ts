"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { MessageDTO, Page } from "@/lib/types";

/*
 * Messages of one chat, oldest first.
 *
 * Cache shape under qk.messages(chatId): MessagesData. The stream store writes
 * finished turns into it with `upsertMessages`, so a refetch that lands later
 * never drops them, and the optimistic turn lives in the stream store (not
 * here) until the server has it.
 */

export const MESSAGE_PAGE_SIZE = 50;

export interface MessagesData {
  items: MessageDTO[];
  /** Cursor for older messages (passed as `before`), or null when there are none. */
  nextCursor: string | null;
}

function normalizeMessage(m: MessageDTO): MessageDTO {
  // Older servers only send _id and may omit the newer arrays.
  const id = m.id ?? m._id;
  return {
    ...m,
    id,
    _id: m._id ?? id,
    sources: m.sources ?? [],
    queries: m.queries ?? [],
    followUps: m.followUps ?? [],
    clarification: m.clarification ?? null,
    research: m.research ?? null,
    model: m.model ?? null,
    feedback: m.feedback ?? null,
    error: m.error ?? null,
    status: m.status ?? "complete",
    mode: m.mode ?? "chat",
    visualType: m.visualType ?? "none",
    chartData: m.chartData ?? null,
    tableData: m.tableData ?? null,
    diagramData: m.diagramData ?? null,
  };
}

/** Accepts a Page<MessageDTO> or the legacy plain array. */
export function toMessagesData(body: Page<MessageDTO> | MessageDTO[] | undefined): MessagesData {
  if (!body) return { items: [], nextCursor: null };
  if (Array.isArray(body)) return { items: body.map(normalizeMessage), nextCursor: null };
  return { items: (body.items ?? []).map(normalizeMessage), nextCursor: body.nextCursor ?? null };
}

export function fetchMessages(chatId: string, opts: { before?: string; signal?: AbortSignal } = {}) {
  return api<Page<MessageDTO> | MessageDTO[]>(`/chats/${encodeURIComponent(chatId)}/messages`, {
    query: { limit: MESSAGE_PAGE_SIZE, before: opts.before },
    signal: opts.signal,
  }).then(toMessagesData);
}

function byCreatedAt(a: MessageDTO, b: MessageDTO) {
  const ta = Date.parse(a.createdAt);
  const tb = Date.parse(b.createdAt);
  if (Number.isNaN(ta) || Number.isNaN(tb) || ta === tb) return 0;
  return ta - tb;
}

/**
 * Inserts or replaces messages by id. New ones go after their parent when it is
 * present (an assistant answer after its question), otherwise at the end.
 * `remove` drops ids first (a regenerated answer replaces the old one).
 */
export function upsertMessages(
  old: MessagesData | undefined,
  incoming: MessageDTO[],
  remove: string[] = [],
): MessagesData {
  const base = old ?? { items: [], nextCursor: null };
  let items = remove.length ? base.items.filter((m) => !remove.includes(m.id)) : [...base.items];
  for (const raw of incoming) {
    const msg = normalizeMessage(raw);
    const at = items.findIndex((m) => m.id === msg.id);
    if (at !== -1) {
      items[at] = msg;
      continue;
    }
    const parentAt = msg.parentId ? items.findIndex((m) => m.id === msg.parentId) : -1;
    if (parentAt !== -1) {
      // After the parent and any earlier answers to it.
      let insertAt = parentAt + 1;
      while (insertAt < items.length && items[insertAt].parentId === msg.parentId) insertAt++;
      items = [...items.slice(0, insertAt), msg, ...items.slice(insertAt)];
    } else {
      items.push(msg);
    }
  }
  return { ...base, items };
}

/** Merges an older page in front of the cached one. */
function prependOlder(old: MessagesData | undefined, older: MessagesData): MessagesData {
  const known = new Set((old?.items ?? []).map((m) => m.id));
  const fresh = older.items.filter((m) => !known.has(m.id));
  return { items: [...fresh, ...(old?.items ?? [])].sort(byCreatedAt), nextCursor: older.nextCursor };
}

export function useMessages(chatId: string | null) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: qk.messages(chatId ?? "none"),
    queryFn: async ({ signal }) => {
      const fresh = await fetchMessages(chatId as string, { signal });
      // Keep any older pages the user already loaded.
      const prev = qc.getQueryData<MessagesData>(qk.messages(chatId as string));
      if (!prev || prev.items.length <= fresh.items.length) return fresh;
      const ids = new Set(fresh.items.map((m) => m.id));
      const firstFresh = fresh.items[0];
      const keepOlder = firstFresh
        ? prev.items.filter((m) => !ids.has(m.id) && byCreatedAt(m, firstFresh) < 0)
        : [];
      return { items: [...keepOlder, ...fresh.items], nextCursor: keepOlder.length ? prev.nextCursor : fresh.nextCursor };
    },
    enabled: !!chatId,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });

  const [loadingOlder, setLoadingOlder] = React.useState(false);
  const cursor = query.data?.nextCursor ?? null;

  const loadOlder = React.useCallback(async () => {
    if (!chatId || !cursor) return;
    setLoadingOlder(true);
    try {
      const older = await fetchMessages(chatId, { before: cursor });
      qc.setQueryData<MessagesData>(qk.messages(chatId), (old) => prependOlder(old, older));
    } finally {
      setLoadingOlder(false);
    }
  }, [chatId, cursor, qc]);

  return { ...query, messages: query.data?.items, hasOlder: !!cursor, loadOlder, loadingOlder };
}
