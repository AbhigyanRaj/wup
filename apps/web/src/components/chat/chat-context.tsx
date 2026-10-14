"use client";

import * as React from "react";
import { useChatStream } from "@/hooks/useChatStream";
import { useComposerPrefs } from "@/hooks/useComposerPrefs";
import type { StreamEntry } from "@/lib/stream-store";

/*
 * Chat screen state shared by the thread, the composer and the sources panel.
 * Lives in the persistent chat layout, so it survives /chat -> /chat/:id.
 */

export interface SourcesTarget {
  messageId: string;
  n: number | null;
}

export interface ChatContextValue {
  chatId: string | null;
  entry: StreamEntry | null;
  /** Sends with the composer's current model, web and research settings. */
  send: (content: string) => Promise<boolean>;
  regenerate: (assistantMessageId: string) => boolean;
  stop: () => void;
  research: boolean;
  setResearch: (v: boolean) => void;
  /** Bridge scope held locally before the chat exists. */
  pendingBridgeIds: string[];
  setPendingBridgeIds: (ids: string[]) => void;
  sources: SourcesTarget | null;
  openSources: (messageId: string, n?: number | null) => void;
  closeSources: () => void;
  prefs: ReturnType<typeof useComposerPrefs>;
}

const ChatContext = React.createContext<ChatContextValue | null>(null);

export function useChatContext(): ChatContextValue {
  const ctx = React.useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used inside <ChatProvider>");
  return ctx;
}

export function ChatProvider({ chatId, children }: { chatId: string | null; children: React.ReactNode }) {
  const stream = useChatStream(chatId);
  const prefs = useComposerPrefs();
  const [research, setResearch] = React.useState(false);
  const [pendingBridgeIds, setPendingBridgeIds] = React.useState<string[]>([]);
  const [sources, setSources] = React.useState<SourcesTarget | null>(null);

  // The sources panel belongs to one chat.
  const [prevChat, setPrevChat] = React.useState(chatId);
  if (prevChat !== chatId) {
    setPrevChat(chatId);
    setSources(null);
    if (chatId) setPendingBridgeIds([]);
  }

  const { send: rawSend, regenerate: rawRegenerate, stop } = stream;
  const { model, searchWeb } = prefs;

  const send = React.useCallback(
    (content: string) =>
      rawSend(content, {
        mode: research ? "research" : "chat",
        model,
        searchWeb,
        bridgeIds: pendingBridgeIds,
      }),
    [rawSend, research, model, searchWeb, pendingBridgeIds],
  );

  const regenerate = React.useCallback(
    (id: string) => rawRegenerate(id, { model, searchWeb }),
    [rawRegenerate, model, searchWeb],
  );

  const openSources = React.useCallback((messageId: string, n: number | null = null) => {
    setSources({ messageId, n });
  }, []);
  const closeSources = React.useCallback(() => setSources(null), []);

  const value = React.useMemo<ChatContextValue>(
    () => ({
      chatId,
      entry: stream.entry,
      send,
      regenerate,
      stop,
      research,
      setResearch,
      pendingBridgeIds,
      setPendingBridgeIds,
      sources,
      openSources,
      closeSources,
      prefs,
    }),
    [chatId, stream.entry, send, regenerate, stop, research, pendingBridgeIds, sources, openSources, closeSources, prefs],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
