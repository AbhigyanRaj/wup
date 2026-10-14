"use client";

import * as React from "react";
import { ArrowUp, MessageCircleQuestion } from "lucide-react";
import type { Clarification } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/*
 * Inline clarifying question.
 * - One <form onSubmit>, so Enter in the text field submits exactly once.
 * - Option buttons are type="button" and send immediately.
 * - Digit hotkeys live on the card's own onKeyDown and are ignored while
 *   focus is in a text field.
 */

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT";
}

export function ClarificationCard({
  clarification,
  fallbackQuestion,
  onAnswer,
  onDismiss,
  disabled,
}: {
  clarification: Clarification;
  /** Shown when the model left `question` empty. */
  fallbackQuestion?: string;
  onAnswer: (text: string) => void;
  onDismiss: () => void;
  disabled?: boolean;
}) {
  const [text, setText] = React.useState("");
  const sentRef = React.useRef(false);
  const titleId = React.useId();
  const inputId = React.useId();
  const options = clarification.options;
  const question = clarification.question || fallbackQuestion || "Which one did you mean?";

  const answer = (value: string) => {
    const v = value.trim();
    if (!v || disabled || sentRef.current) return;
    sentRef.current = true;
    onAnswer(v);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[1-9]$/.test(e.key)) {
      const opt = options[Number(e.key) - 1];
      if (opt) {
        e.preventDefault();
        answer(opt);
      }
    }
  };

  return (
    <form
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
      onSubmit={(e) => {
        e.preventDefault();
        answer(text);
      }}
      className="mt-5 rounded-2xl border border-indigo-200 bg-sf-white p-4 shadow-[0_1px_0_#ffffff_inset,0_8px_24px_-12px_rgb(85_106_220/0.18)] sm:p-5"
      data-testid="clarification"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-800 ring-1 ring-indigo-100">
          <MessageCircleQuestion className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-tx-tertiary">Quick question</p>
          <h3 id={titleId} className="mt-1 text-[16px] font-medium leading-[1.5] text-tx">
            {question}
          </h3>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-1.5" role="group" aria-label="Options">
        {options.map((opt, i) => (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            onClick={() => answer(opt)}
            className={cn(
              "group/opt flex min-h-11 w-full items-center gap-3 rounded-xl border border-st-secondary bg-bg px-3 py-2 text-left text-[15px] leading-[1.45] text-tx-secondary",
              "transition-[background-color,border-color,color] duration-200 ease-standard",
              "hover:border-indigo-200 hover:bg-indigo-50 hover:text-tx",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            <kbd
              aria-hidden="true"
              className="flex size-6 shrink-0 items-center justify-center rounded-md border border-st bg-sf-white font-mono text-[12px] text-tx-tertiary transition-colors group-hover/opt:border-indigo-200 group-hover/opt:text-indigo-800"
            >
              {i + 1}
            </kbd>
            <span className="min-w-0 flex-1">{opt}</span>
          </button>
        ))}
      </div>

      {clarification.allowFreeText ? (
        <div className="mt-3">
          <label htmlFor={inputId} className="sr-only">
            Or type your own answer
          </label>
          <div className="flex items-center gap-2 rounded-xl border border-st bg-sf-white py-1 pl-3.5 pr-1 transition-[border-color,box-shadow] duration-200 focus-within:border-indigo-300 focus-within:shadow-focus">
            <input
              id={inputId}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Or type your own answer"
              autoComplete="off"
              disabled={disabled}
              className="h-9 min-w-0 flex-1 bg-transparent text-[16px] text-tx outline-none placeholder:text-tx-muted md:text-[15px]"
            />
            <button
              type="submit"
              aria-label="Send answer"
              disabled={disabled || !text.trim()}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-white shadow-btn-ink transition-[transform,opacity] duration-150 active:scale-[0.96] disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
            >
              <ArrowUp className="size-4" strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="hidden text-[12px] text-tx-muted sm:block">
          Press <kbd className="font-mono">1</kbd> to <kbd className="font-mono">{Math.min(options.length, 9)}</kbd> to
          pick an option
        </p>
        <Button variant="ghost" size="sm" onClick={onDismiss} className="ml-auto">
          Dismiss
        </Button>
      </div>
    </form>
  );
}
