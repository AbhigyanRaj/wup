"use client";

import * as React from "react";
import type { MessageDTO } from "@/lib/types";
import { isActivePhase, renderKeyFor, streamStore, useAnyStreamActive, type StreamEntry } from "@/lib/stream-store";
import { useMessages } from "@/hooks/data/useMessages";
import { useUsage } from "@/hooks/data/useUsage";
import { useMe } from "@/hooks/data/useMe";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useChatContext } from "./chat-context";
import { UserMessage } from "./messages/user-message";
import { AssistantMessage } from "./messages/assistant-message";
import { FreeLimitCard } from "./messages/notices";

/*
 * The conversation: server messages followed by the stream overlay (the
 * optimistic question and the live answer). Overlay items disappear as soon as
 * the server list contains their ids, and keep their client keys after that,
 * so a finished answer never remounts.
 */

export type ThreadItem =
  | { kind: "user"; key: string; message: MessageDTO }
  | { kind: "assistant"; key: string; message: MessageDTO | null; live: StreamEntry | null }
  | { kind: "free-limit"; key: string };

export function buildTimeline(messages: MessageDTO[], entry: StreamEntry | null): ThreadItem[] {
  const ids = new Set(messages.map((m) => m.id));
  const items: ThreadItem[] = [];
  const liveAssistantId = entry ? entry.final?.assistantMessage?.id ?? entry.assistantMessageId : undefined;

  for (const m of messages) {
    if (entry?.replacesMessageId === m.id && isActivePhase(entry.phase)) continue;
    const key = renderKeyFor(m.id);
    if (m.role === "user") items.push({ kind: "user", key, message: m });
    else {
      // The finished stream's answer: keep the entry attached for timing info.
      const live = entry && liveAssistantId === m.id ? entry : null;
      items.push({ kind: "assistant", key, message: m, live });
    }
  }

  if (!entry) return items;

  const userId = entry.final?.userMessage?.id ?? entry.userMessageId;
  if (entry.userMessage && entry.userKey && !(userId && ids.has(userId))) {
    items.push({ kind: "user", key: entry.userKey, message: entry.final?.userMessage ?? entry.userMessage });
  }

  if (entry.phase === "error" && entry.error?.code === "FREE_LIMIT_REACHED") {
    items.push({ kind: "free-limit", key: `limit-${entry.streamId}` });
    return items;
  }

  if (!(liveAssistantId && ids.has(liveAssistantId))) {
    items.push({
      kind: "assistant",
      key: entry.draft.clientKey,
      message: entry.final?.assistantMessage ?? null,
      live: entry,
    });
  }
  return items;
}

function ThreadSkeleton() {
  return (
    <div className="flex flex-col gap-10 pt-10" aria-hidden="true">
      <div className="flex justify-end">
        <Skeleton className="h-11 w-[46%] rounded-2xl" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="w-[92%]" />
        <Skeleton className="w-[86%]" />
        <Skeleton className="w-[64%]" />
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-11 w-[34%] rounded-2xl" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="w-[88%]" />
        <Skeleton className="w-[72%]" />
      </div>
    </div>
  );
}

export function ThreadState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-24 text-center" role="alert">
      <p className="text-[20px] font-medium leading-[1.3] tracking-[-0.015em] text-tx">{title}</p>
      <p className="mt-2 max-w-sm text-[15px] leading-[1.6] text-tx-tertiary">{body}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function Thread({ chatId, onStreamStart }: { chatId: string; onStreamStart: () => void }) {
  const { messages, isLoading, isError, error, refetch, hasOlder, loadOlder, loadingOlder } = useMessages(chatId);
  const { entry, send, regenerate, openSources } = useChatContext();
  const anyActive = useAnyStreamActive();
  const { data: usage } = useUsage();
  const { data: me } = useMe();
  const showQueries = !!me?.preferences?.showQueriesByDefault;

  const items = React.useMemo(() => buildTimeline(messages ?? [], entry), [messages, entry]);

  // Jump to the bottom whenever a new turn starts here.
  const streamId = entry?.streamId;
  React.useEffect(() => {
    if (streamId) onStreamStart();
  }, [streamId, onStreamStart]);

  const onSend = React.useCallback((text: string) => void send(text), [send]);
  const onRegenerate = React.useCallback((id: string) => void regenerate(id), [regenerate]);
  const onRetry = React.useCallback(
    (failed: StreamEntry) => {
      if (failed.request.content) {
        streamStore.clear(chatId);
        void send(failed.request.content);
      } else if (failed.replacesMessageId) {
        streamStore.clear(chatId);
        void regenerate(failed.replacesMessageId);
      }
    },
    [chatId, send, regenerate],
  );

  const notFound = isError && (error as { status?: number } | null)?.status === 404;

  if (notFound) {
    return (
      <ThreadState
        title="This chat doesn't exist or was deleted"
        body="It may have been removed in another tab. Start a new chat to keep going."
        action={
          <Button variant="soft" onClick={() => window.location.assign("/chat")}>
            New chat
          </Button>
        }
      />
    );
  }

  if (isError && !items.length) {
    return (
      <ThreadState
        title="Couldn't load this chat"
        body="Check your connection and try again."
        action={
          <Button variant="soft" onClick={() => void refetch()}>
            Try again
          </Button>
        }
      />
    );
  }

  if (isLoading && !items.length) return <ThreadSkeleton />;

  const lastIndex = items.length - 1;

  return (
    <div className="flex flex-col gap-8 pb-6 pt-8 md:gap-10" data-testid="thread">
      {hasOlder ? (
        <div className="flex justify-center">
          <Button variant="ghost" size="sm" onClick={() => void loadOlder()} disabled={loadingOlder}>
            {loadingOlder ? <Spinner size="sm" label={null} /> : null}
            {loadingOlder ? "Loading" : "Load earlier messages"}
          </Button>
        </div>
      ) : null}
      {items.map((item, i) => {
        if (item.kind === "user") return <UserMessage key={item.key} message={item.message} />;
        if (item.kind === "free-limit") return <FreeLimitCard key={item.key} limit={usage?.plan.limit} />;
        return (
          <AssistantMessage
            key={item.key}
            chatId={chatId}
            message={item.message}
            live={item.live}
            isLast={i === lastIndex}
            busy={anyActive}
            onSend={onSend}
            onRegenerate={onRegenerate}
            onRetry={onRetry}
            onOpenSources={openSources}
            defaultQueriesOpen={showQueries}
          />
        );
      })}
    </div>
  );
}
