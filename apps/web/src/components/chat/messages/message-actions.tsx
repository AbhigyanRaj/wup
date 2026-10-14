"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { FeedbackRating, MessageDTO, Source } from "@/lib/types";
import type { MessagesData } from "@/hooks/data/useMessages";
import { useFeature } from "@/lib/capabilities";
import { TooltipContent, TooltipRoot, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { CopyButton } from "../copy-button";
import { SourceKindIcon } from "../citation";
import { holdback } from "@/lib/markdown/holdback";

const iconBtn =
  "inline-flex size-8 items-center justify-center rounded-full text-tx-tertiary transition-colors duration-200 ease-standard hover:bg-sf-secondary hover:text-tx focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 disabled:pointer-events-none disabled:opacity-40";

function ActionTip({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <TooltipRoot delayDuration={400}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </TooltipRoot>
  );
}

function useFeedback(chatId: string, messageId: string) {
  const qc = useQueryClient();
  return useMutation({
    meta: { errorMessage: "Couldn't save your feedback." },
    mutationFn: (rating: FeedbackRating | null) =>
      api(`/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/feedback`, {
        method: "PUT",
        json: { rating },
      }),
    onMutate: (rating) => {
      const prev = qc.getQueryData<MessagesData>(qk.messages(chatId));
      qc.setQueryData<MessagesData>(qk.messages(chatId), (old) =>
        old
          ? {
              ...old,
              items: old.items.map((m) =>
                m.id === messageId
                  ? { ...m, feedback: rating ? { rating, note: null, at: new Date().toISOString() } : null }
                  : m,
              ),
            }
          : old,
      );
      return { prev };
    },
    onError: (_e, _r, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.messages(chatId), ctx.prev);
    },
  });
}

function SourceStack({ sources }: { sources: Source[] }) {
  const kinds = Array.from(new Set(sources.map((s) => s.kind))).slice(0, 3);
  return (
    <span className="flex -space-x-1" aria-hidden="true">
      {kinds.map((k) => (
        <span key={k} className="flex size-5 items-center justify-center rounded-full bg-sf-white ring-1 ring-st">
          <SourceKindIcon kind={k} className="size-3 text-tx-tertiary" />
        </span>
      ))}
    </span>
  );
}

export function MessageActions({
  chatId,
  message,
  sources,
  isLast,
  canRegenerate,
  onRegenerate,
  onOpenSources,
}: {
  chatId: string;
  message: MessageDTO;
  sources: Source[];
  isLast: boolean;
  canRegenerate: boolean;
  onRegenerate: () => void;
  onOpenSources: () => void;
}) {
  const feedbackOn = useFeature("feedback");
  const regenerateOn = useFeature("regenerate");
  const feedback = useFeedback(chatId, message.id);
  const rating = message.feedback?.rating ?? null;
  const isLocal = message.id.startsWith("local-");

  return (
    <div
      className={cn(
        "mt-3 flex flex-wrap items-center gap-0.5 transition-opacity duration-200",
        !isLast && "md:opacity-0 md:group-hover/answer:opacity-100 md:focus-within:opacity-100",
      )}
    >
      <ActionTip label="Copy">
        <span>
          <CopyButton value={() => holdback(message.content, false)} label="Copy answer" className="size-8 justify-center px-0" />
        </span>
      </ActionTip>
      {isLast && regenerateOn ? (
        <ActionTip label="Regenerate">
          <button
            type="button"
            aria-label="Regenerate answer"
            className={iconBtn}
            disabled={!canRegenerate || isLocal}
            onClick={onRegenerate}
          >
            <RotateCcw className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
          </button>
        </ActionTip>
      ) : null}
      {feedbackOn && !isLocal ? (
        <>
          <ActionTip label="Good answer">
            <button
              type="button"
              aria-label="Good answer"
              aria-pressed={rating === "up"}
              className={cn(iconBtn, rating === "up" && "bg-indigo-50 text-indigo-800 hover:bg-indigo-50 hover:text-indigo-800")}
              onClick={() => feedback.mutate(rating === "up" ? null : "up")}
            >
              <ThumbsUp className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </ActionTip>
          <ActionTip label="Bad answer">
            <button
              type="button"
              aria-label="Bad answer"
              aria-pressed={rating === "down"}
              className={cn(iconBtn, rating === "down" && "bg-indigo-50 text-indigo-800 hover:bg-indigo-50 hover:text-indigo-800")}
              onClick={() => feedback.mutate(rating === "down" ? null : "down")}
            >
              <ThumbsDown className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </ActionTip>
        </>
      ) : null}

      {sources.length ? (
        <button
          type="button"
          onClick={onOpenSources}
          className="ml-1.5 inline-flex h-8 items-center gap-2 rounded-full border border-st-secondary bg-sf-white pl-1.5 pr-3 text-[13px] text-tx-secondary transition-colors duration-200 ease-standard hover:border-st hover:bg-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
        >
          <SourceStack sources={sources} />
          {sources.length} {sources.length === 1 ? "source" : "sources"}
        </button>
      ) : null}

      <span className="ml-auto flex items-center gap-2 pl-2">
        {message.status === "stopped" ? (
          <span className="pill pill--neutral text-[12px]" data-testid="stopped-badge">
            Stopped
          </span>
        ) : null}
        {message.model?.id ? (
          <span
            className="max-w-[180px] truncate font-mono text-[11px] text-tx-muted"
            title={message.model.usingOwnKey ? `${message.model.id} (your key)` : message.model.id}
          >
            {message.model.id}
          </span>
        ) : null}
      </span>
    </div>
  );
}
