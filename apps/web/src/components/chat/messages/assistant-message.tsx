"use client";

import * as React from "react";
import { CircleAlert } from "lucide-react";
import type { MessageDTO, Source } from "@/lib/types";
import { draftToMessage, isActivePhase, type StreamEntry } from "@/lib/stream-store";
import { unifySources } from "@/lib/sources";
import { CitationContext, type CitationContextValue } from "../citation";
import { Markdown } from "../markdown/markdown";
import { VisualBlock } from "../renderers";
import { ThinkingSteps, TypingDots } from "./thinking-steps";
import { ResearchTimeline } from "./research-timeline";
import { QueriesUsed } from "./queries-used";
import { ClarificationCard } from "./clarification-card";
import { FollowUpChips } from "./follow-up-chips";
import { ErrorInline } from "./notices";
import { MessageActions } from "./message-actions";

/*
 * One answer: live (from the stream store) or saved (from the server).
 * Wrapped in an error boundary so one malformed answer never takes the
 * thread down.
 */

export interface AssistantMessageProps {
  chatId: string;
  /** The saved message (null while streaming). */
  message: MessageDTO | null;
  /** The stream entry this answer came from (live or just finished). */
  live: StreamEntry | null;
  isLast: boolean;
  /** Another answer is streaming somewhere (disables regenerate / follow-ups). */
  busy: boolean;
  onSend: (text: string) => void;
  onRegenerate: (assistantMessageId: string) => void;
  onRetry: (entry: StreamEntry) => void;
  onOpenSources: (messageId: string, n?: number | null) => void;
  defaultQueriesOpen?: boolean;
}

const dismissed = new Set<string>();

function AssistantMessageInner({
  chatId,
  message: saved,
  live,
  isLast,
  busy,
  onSend,
  onRegenerate,
  onRetry,
  onOpenSources,
  defaultQueriesOpen,
}: AssistantMessageProps) {
  const streaming = !!live && isActivePhase(live.phase);
  // A stream that ended without a saved message still shows what arrived.
  const message = React.useMemo(
    () => saved ?? (live && !streaming ? draftToMessage(live) : null),
    [saved, live, streaming],
  );
  const isLocal = !!message && message.id.startsWith("local-");
  const content = message?.content ?? live?.draft.content ?? "";
  const draftSources = live?.draft.sources;
  const sources: Source[] = React.useMemo(
    () => (message ? unifySources(message) : draftSources ?? []),
    [message, draftSources],
  );
  const messageId = message?.id ?? live?.assistantMessageId ?? live?.draft.clientKey ?? "";
  const steps = message?.research?.steps?.length ? message.research.steps : live?.draft.steps ?? [];
  const durationMs =
    message?.research?.durationMs ??
    (live && live.endedAt ? live.endedAt - live.draft.startedAt : null);
  const status = message?.status ?? (live?.phase === "aborted" ? "stopped" : live?.phase === "error" ? "error" : "complete");
  const errorText = message?.error?.message ?? (live?.phase === "error" ? live.error?.message : undefined);
  const [isDismissed, setDismissed] = React.useState(() => dismissed.has(messageId));

  const openSource = React.useCallback((n: number) => onOpenSources(messageId, n), [onOpenSources, messageId]);
  const citationValue = React.useMemo<CitationContextValue>(
    () => ({ sources, openSource: message ? openSource : undefined }),
    [sources, openSource, message],
  );

  const retry = () => {
    if (live && live.phase === "error" && (!saved || isLocal)) onRetry(live);
    else if (message) onRegenerate(message.id);
  };

  const showThinking = streaming && !content;
  const isResearch = (message?.mode ?? live?.mode) === "research" || steps.length > 0;

  return (
    <article
      className="group/answer relative"
      aria-label="wuup's answer"
      aria-busy={streaming || undefined}
      data-role="assistant"
      data-status={streaming ? "streaming" : status}
    >
      {isResearch && steps.length ? (
        <ResearchTimeline
          steps={steps}
          running={streaming}
          durationMs={durationMs}
          onOpenSource={message ? openSource : undefined}
        />
      ) : null}

      {showThinking ? (
        <ThinkingSteps
          statuses={live?.draft.statuses ?? []}
          tools={live?.draft.tools ?? []}
          startedAt={live?.draft.startedAt ?? 0}
          label={isResearch ? "Planning" : live?.phase === "connecting" ? "Connecting" : "Thinking"}
        />
      ) : null}

      {content ? (
        <CitationContext.Provider value={citationValue}>
          <Markdown content={content} streaming={streaming} />
        </CitationContext.Provider>
      ) : null}

      {streaming && content ? <TypingDots className="mt-2" /> : null}

      {!streaming && !content && status === "stopped" ? (
        <p className="text-[15px] italic text-tx-tertiary">Stopped before wuup started answering.</p>
      ) : null}

      {message && message.visualType !== "none" ? (
        <div className="mt-4">
          <VisualBlock message={message} />
        </div>
      ) : null}

      {message?.queries?.length ? (
        <QueriesUsed queries={message.queries} defaultOpen={defaultQueriesOpen} id={`queries-${message.id}`} />
      ) : null}

      {!streaming && status === "error" ? (
        <ErrorInline
          message={errorText || "Something went wrong while answering."}
          onRetry={isLast && !busy ? retry : undefined}
        />
      ) : null}

      {message && isLast && !streaming && !busy && message.clarification && !isDismissed ? (
        <ClarificationCard
          clarification={message.clarification}
          fallbackQuestion={undefined}
          onAnswer={onSend}
          onDismiss={() => {
            dismissed.add(messageId);
            setDismissed(true);
          }}
          disabled={busy}
        />
      ) : null}

      {!streaming && message ? (
        <MessageActions
          chatId={chatId}
          message={message}
          sources={sources}
          isLast={isLast}
          canRegenerate={!busy && !!saved}
          onRegenerate={() => onRegenerate(message.id)}
          onOpenSources={() => onOpenSources(messageId, null)}
        />
      ) : null}

      {message && isLast && !streaming && !busy && !message.clarification && message.followUps?.length ? (
        <FollowUpChips followUps={message.followUps} onPick={onSend} />
      ) : null}
    </article>
  );
}

class AnswerBoundary extends React.Component<{ children: React.ReactNode; resetKey: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }
  componentDidCatch(error: unknown) {
    if (process.env.NODE_ENV !== "production") console.error("Answer failed to render", error);
  }
  render() {
    if (this.state.failed) {
      return (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-st-secondary bg-sf-white px-4 py-3 text-[14px] text-tx-tertiary">
          <CircleAlert className="size-4 text-red-400" strokeWidth={1.5} aria-hidden="true" />
          This answer couldn&apos;t be displayed. Reload the page to try again.
        </div>
      );
    }
    return this.props.children;
  }
}

export const AssistantMessage = React.memo(function AssistantMessage(props: AssistantMessageProps) {
  const resetKey = `${props.message?.id ?? ""}:${props.message?.content.length ?? props.live?.draft.content.length ?? 0}`;
  return (
    <AnswerBoundary resetKey={resetKey}>
      <AssistantMessageInner {...props} />
    </AnswerBoundary>
  );
});
