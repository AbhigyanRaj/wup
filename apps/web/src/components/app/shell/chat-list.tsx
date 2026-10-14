"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useStreamingChatIds } from "@/lib/stream-store";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useAppUI } from "@/components/app/app-ui-provider";
import { flattenChats, groupChats, useChatList, useDeleteChat, useUpdateChat } from "@/components/app/chat-cache";
import { ChatRow } from "./chat-row";

export function ChatList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { openConfirm } = useAppUI();
  const list = useChatList();
  const update = useUpdateChat();
  const del = useDeleteChat();
  const streamingIds = useStreamingChatIds();
  const streaming = React.useMemo(() => new Set(streamingIds), [streamingIds]);

  const chats = React.useMemo(() => flattenChats(list.data), [list.data]);
  const groups = React.useMemo(() => groupChats(chats), [chats]);
  const activeId = pathname?.startsWith("/chat/") ? decodeURIComponent(pathname.split("/")[2] ?? "") : null;

  // Infinite scroll: load the next page when the sentinel nears the viewport.
  const sentinel = React.useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  React.useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (list.isPending) {
    return (
      <div className="space-y-1.5 px-2.5 pt-3" aria-hidden="true">
        <Skeleton style={{ height: 10, width: 56, marginBottom: 14 }} />
        {[72, 88, 64, 80, 56, 76].map((w, i) => (
          <Skeleton key={i} style={{ height: 12, width: `${w}%`, marginBottom: 14 }} />
        ))}
      </div>
    );
  }

  if (list.isError && chats.length === 0) {
    return (
      <div className="px-2.5 pt-4 text-[13px] leading-5 text-tx-tertiary">
        Couldn&apos;t load your chats.{" "}
        <button
          type="button"
          onClick={() => void list.refetch()}
          className="text-tx-accent underline decoration-current/30 underline-offset-2 hover:decoration-current"
        >
          Try again
        </button>
      </div>
    );
  }

  if (chats.length === 0) {
    return (
      <p className="px-2.5 pt-4 text-[13px] leading-5 text-tx-muted">
        Your chats will show up here.
      </p>
    );
  }

  return (
    <nav aria-label="Chats" className="pb-2">
      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`chat-group-${g.key}`} className="mt-4 first:mt-2">
          <h2
            id={`chat-group-${g.key}`}
            className="flex h-7 items-center px-2.5 text-[12px] font-medium uppercase leading-none tracking-[0.06em] text-tx-tertiary"
          >
            {g.label}
          </h2>
          <ul className="flex flex-col gap-px">
            {g.chats.map((chat) => (
              <ChatRow
                key={chat.id}
                chat={chat}
                active={chat.id === activeId}
                streaming={streaming.has(chat.id)}
                onNavigate={onNavigate}
                onRename={(title) => update.mutate({ id: chat.id, patch: { title } })}
                onTogglePin={() => update.mutate({ id: chat.id, patch: { pinned: !chat.pinned } })}
                onDelete={() =>
                  openConfirm({
                    title: "Delete this chat?",
                    body: "This removes the chat and its messages. You can't undo this.",
                    confirmLabel: "Delete",
                    tone: "danger",
                    onConfirm: async () => {
                      if (chat.id === activeId) router.push("/chat");
                      await del.mutateAsync(chat.id).catch(() => undefined);
                    },
                  })
                }
              />
            ))}
          </ul>
        </section>
      ))}
      <div ref={sentinel} className="h-px" aria-hidden="true" />
      {isFetchingNextPage ? (
        <div className="flex justify-center py-3">
          <Spinner size="sm" label="Loading more chats" />
        </div>
      ) : null}
    </nav>
  );
}
