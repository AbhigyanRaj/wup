"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { bindQueryClient, seedNewChat, streamStore, useStreamEntry } from "@/lib/stream-store";
import { createChat } from "@/hooks/data/useChats";
import type { ChatMode } from "@/lib/types";

/*
 * The chat screen's handle on the stream store.
 *
 * send(content) works for both an existing chat and the new-chat screen:
 *   POST /chats {bridgeIds} -> seed caches -> streamStore.start -> router.replace
 * The chat layout persists across that navigation, so the composer keeps
 * focus and the stream keeps rendering.
 */

export interface SendOptions {
  mode?: ChatMode;
  model?: string;
  searchWeb?: boolean;
  /** Bridges for a chat that does not exist yet (empty = all data). */
  bridgeIds?: string[];
}

const BUSY_MESSAGE = "wuup is still answering. Wait for it to finish or stop it first.";

export function useChatStream(chatId: string | null) {
  const qc = useQueryClient();
  const router = useRouter();
  const entry = useStreamEntry(chatId);

  // Bind synchronously so the very first send can write to the cache.
  bindQueryClient(qc);

  const send = React.useCallback(
    async (content: string, opts: SendOptions = {}): Promise<boolean> => {
      const text = content.trim();
      if (!text) return false;
      const streamOpts = { content: text, mode: opts.mode, model: opts.model, searchWeb: opts.searchWeb };

      if (chatId) {
        const r = streamStore.start(chatId, streamOpts);
        if (!r.ok && r.reason === "busy") toast(BUSY_MESSAGE);
        return r.ok;
      }

      // New chat: the create call itself counts as "active" (one POST per submit).
      if (!streamStore.beginCreate()) {
        toast(BUSY_MESSAGE);
        return false;
      }
      let id: string;
      try {
        const chat = await createChat(opts.bridgeIds?.length ? { bridgeIds: opts.bridgeIds } : {});
        seedNewChat(chat);
        id = chat.id;
      } catch (e) {
        streamStore.endCreate();
        toast.error("Couldn't start a new chat", { description: errorMessage(e) });
        return false;
      }
      streamStore.endCreate();
      const r = streamStore.start(id, streamOpts);
      router.replace(`/chat/${encodeURIComponent(id)}`, { scroll: false });
      return r.ok;
    },
    [chatId, router],
  );

  const regenerate = React.useCallback(
    (assistantMessageId: string, opts: Omit<SendOptions, "bridgeIds"> = {}) => {
      if (!chatId) return false;
      const r = streamStore.regenerate(chatId, assistantMessageId, opts);
      if (!r.ok && r.reason === "busy") toast(BUSY_MESSAGE);
      return r.ok;
    },
    [chatId],
  );

  const stop = React.useCallback(() => {
    if (chatId) streamStore.stop(chatId);
  }, [chatId]);

  return { entry, send, regenerate, stop };
}
