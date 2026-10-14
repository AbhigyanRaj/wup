"use client";

import * as React from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown } from "lucide-react";
import { useStickToBottom } from "@/hooks/useStickToBottom";
import { useMessages } from "@/hooks/data/useMessages";
import { useChat } from "@/hooks/data/useChats";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { ABORT_ON_SWITCH, streamStore } from "@/lib/stream-store";
import { TopBarSlot } from "@/components/app/shell/top-bar";
import { cn } from "@/lib/cn";
import { ChatProvider, useChatContext } from "./chat-context";
import { Thread } from "./thread";
import { Composer } from "./composer/composer";
import { NewChatBelow, NewChatHero } from "./empty/new-chat-empty";
import { SourcesPanel, SOURCES_PANEL_QUERY } from "./sources-panel";
import { ChatTopActions } from "./chat-top-actions";

/*
 * The chat screen, rendered by the persistent chat layout for both /chat and
 * /chat/:chatId. The element tree is the same in both modes:
 *   [scroll area] [composer dock] [below-the-composer area]
 * so the composer keeps focus (and its draft) when the first message turns
 * the new-chat screen into a thread.
 */

function useChatIdFromRoute(): string | null {
  const params = useParams<{ chatId?: string | string[] }>();
  const pathname = usePathname();
  const raw = params?.chatId;
  const fromParams = Array.isArray(raw) ? raw[0] : raw;
  if (fromParams) return decodeURIComponent(fromParams);
  const m = /^\/chat\/([^/?#]+)/.exec(pathname ?? "");
  return m ? decodeURIComponent(m[1]) : null;
}

export function ChatScreen() {
  const chatId = useChatIdFromRoute();

  // Optional: abort a background stream when leaving its chat.
  const prev = React.useRef(chatId);
  React.useEffect(() => {
    if (ABORT_ON_SWITCH && prev.current && prev.current !== chatId) streamStore.stop(prev.current);
    prev.current = chatId;
  }, [chatId]);

  return (
    <ChatProvider chatId={chatId}>
      <ChatLayout chatId={chatId} />
      <React.Suspense fallback={null}>
        <QuerySend />
      </React.Suspense>
    </ChatProvider>
  );
}

/** `/chat?q=<text>&send=1` sends once, then strips the params ("Try asking" links). */
function QuerySend() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { send } = useChatContext();
  const handled = React.useRef<string | null>(null);
  const q = params.get("q");
  const shouldSend = params.get("send") === "1";

  React.useEffect(() => {
    if (!q || !shouldSend) return;
    const sig = `${pathname}?${q}`;
    if (handled.current === sig) return;
    handled.current = sig;
    // Strip first so a reload (or a re-render) never sends twice.
    router.replace(pathname, { scroll: false });
    void send(q);
  }, [q, shouldSend, pathname, router, send]);

  React.useEffect(() => {
    if (!q || shouldSend) return;
    // Prefill only.
    window.dispatchEvent(new CustomEvent("wuup:restore-draft", { detail: { chatId: null, content: q } }));
    router.replace(pathname, { scroll: false });
  }, [q, shouldSend, pathname, router]);

  return null;
}

function ChatTitle({ chatId }: { chatId: string }) {
  const chat = useChat(chatId);
  const title = chat.data?.title || "Chat";
  return (
    <>
      <title>{`${title} | wuup`}</title>
      <TopBarSlot
        title={<span className="truncate text-[15px] font-medium text-tx">{title}</span>}
        actions={chat.data ? <ChatTopActions chat={chat.data} /> : null}
      />
    </>
  );
}

function ChatLayout({ chatId }: { chatId: string | null }) {
  const { send, sources, closeSources, entry } = useChatContext();
  const { scrollRef, contentRef, isPinned, scrollToBottom } = useStickToBottom<HTMLDivElement, HTMLDivElement>();
  const docked = useMediaQuery(SOURCES_PANEL_QUERY, true);
  const isThread = !!chatId;
  const chat = useChat(chatId);

  // A new chat opens at the bottom.
  React.useLayoutEffect(() => {
    scrollToBottom("auto");
  }, [chatId, scrollToBottom]);

  const onStreamStart = React.useCallback(() => scrollToBottom("smooth"), [scrollToBottom]);

  // Sources panel target: a saved message, or the live answer.
  const { messages } = useMessages(chatId);
  const sourcesMessage = React.useMemo(() => {
    if (!sources) return null;
    const saved = messages?.find((m) => m.id === sources.messageId);
    if (saved) return saved;
    const fin = entry?.final?.assistantMessage;
    return fin && fin.id === sources.messageId ? fin : null;
  }, [sources, messages, entry]);
  const question = React.useMemo(() => {
    if (!sourcesMessage) return undefined;
    return messages?.find((m) => m.id === sourcesMessage.parentId)?.content;
  }, [sourcesMessage, messages]);
  const liveSources =
    !sourcesMessage && entry && (entry.assistantMessageId === sources?.messageId || entry.draft.clientKey === sources?.messageId)
      ? entry.draft.sources
      : undefined;

  const chatTitle = chat.data?.title;

  return (
    <div className="flex h-full min-h-0">
      {isThread ? <ChatTitle chatId={chatId} /> : <title>New chat | wuup</title>}
      <h1 className="sr-only">{isThread ? chatTitle || "Chat" : "New chat"}</h1>

      <div
        className={cn(
          "relative flex min-w-0 flex-1 flex-col",
          isThread ? "overflow-hidden" : "overflow-y-auto",
        )}
      >
        {/* 1. Scroll area: the thread, or the new-chat hero */}
        <div
          ref={scrollRef}
          className={cn(
            "[overflow-anchor:none]",
            isThread ? "min-h-0 flex-1 overflow-y-auto" : "flex flex-[1_0_auto] flex-col justify-end",
          )}
          tabIndex={isThread ? -1 : undefined}
          aria-label={isThread ? "Conversation" : undefined}
          role={isThread ? "region" : undefined}
        >
          <div
            ref={contentRef}
            className={cn("mx-auto w-full max-w-[760px] px-4 sm:px-6", !isThread && "pb-8 pt-16 md:pb-10")}
          >
            {isThread ? <Thread chatId={chatId} onStreamStart={onStreamStart} /> : <NewChatHero />}
          </div>
        </div>

        {/* 2. Composer dock: same element in both modes */}
        <div
          className={cn(
            "relative z-10 shrink-0 px-3 sm:px-6",
            isThread
              ? "bg-linear-to-t from-bg from-60% to-transparent pb-3 pt-2 sm:pb-4"
              : "pb-2",
          )}
        >
          {isThread && !isPinned ? (
            <div className="pointer-events-none absolute inset-x-0 -top-12 flex justify-center">
              <button
                type="button"
                onClick={() => scrollToBottom("smooth")}
                className="pointer-events-auto inline-flex h-9 items-center gap-1.5 rounded-full border border-st bg-sf-white px-3.5 text-[13px] text-tx-secondary shadow-card transition-colors duration-200 hover:text-tx focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
              >
                <ArrowDown className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
                Jump to latest
              </button>
            </div>
          ) : null}
          <div className="mx-auto w-full max-w-[760px]">
            <Composer autoFocus />
          </div>
        </div>

        {/* 3. Below the composer: onboarding and suggestions on a new chat */}
        {!isThread ? (
          <div className="flex-[1_0_auto] px-4 pb-16 pt-8 sm:px-6">
            <div className="mx-auto w-full max-w-[760px]">
              <NewChatBelow onPick={(text) => void send(text)} />
            </div>
          </div>
        ) : null}
      </div>

      {isThread ? (
        <SourcesPanel
          open={!!sources}
          message={sourcesMessage}
          liveSources={liveSources}
          activeN={sources?.n ?? null}
          question={question}
          onClose={closeSources}
          key={docked ? "aside" : "drawer"}
        />
      ) : null}
    </div>
  );
}
