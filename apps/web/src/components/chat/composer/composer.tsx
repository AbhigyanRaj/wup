"use client";

import * as React from "react";
import { ArrowUp, Globe, Telescope } from "lucide-react";
import { TooltipContent, TooltipRoot, TooltipTrigger } from "@/components/ui/tooltip";
import { useFeature, useMeta } from "@/lib/capabilities";
import { useUsage } from "@/hooks/data/useUsage";
import { useChat, useUpdateChatScope } from "@/hooks/data/useChats";
import { isActivePhase, RESTORE_DRAFT_EVENT, useAnyStreamActive, type RestoreDraftDetail } from "@/lib/stream-store";
import { cn } from "@/lib/cn";
import { useChatContext } from "../chat-context";
import { AttachMenu, ModelPicker, ScopePicker, toolChip, toolChipOff, toolChipOn } from "./toolbar-parts";

/*
 * The composer (kit .prompt): a translucent 24px ring around a white 12px
 * box. Enter sends, Shift+Enter adds a line, Enter during IME composition is
 * ignored, Esc stops a running answer. Drafts are kept per chat in
 * sessionStorage.
 */

export const FOCUS_COMPOSER_EVENT = "wuup:focus-composer";
export const TOGGLE_RESEARCH_EVENT = "wuup:toggle-research";

const MAX_HEIGHT = 200;
/** LIMITS.maxPromptChars in @wup/contracts (kept local so zod stays out of the bundle). */
const DEFAULT_MAX_PROMPT = 8000;

function draftKey(chatId: string | null) {
  return `wuup:draft:${chatId ?? "new"}`;
}

function readDraft(chatId: string | null) {
  try {
    return window.sessionStorage.getItem(draftKey(chatId)) ?? "";
  } catch {
    return "";
  }
}

function writeDraft(chatId: string | null, value: string) {
  try {
    if (value) window.sessionStorage.setItem(draftKey(chatId), value);
    else window.sessionStorage.removeItem(draftKey(chatId));
  } catch {
    /* storage blocked */
  }
}

function UsageLine() {
  const { data } = useUsage();
  const plan = data?.plan;
  let lead: string | null = null;
  if (plan?.tier === "free" && plan.remaining !== null && plan.remaining !== undefined) {
    lead = `Free plan · ${plan.remaining} ${plan.remaining === 1 ? "answer" : "answers"} left.`;
  } else if (plan?.tier === "byok") {
    lead = "Using your own key.";
  } else if (plan?.tier === "demo") {
    lead = "Demo sandbox.";
  }
  return (
    <p className="mt-2.5 px-2 text-center text-[12px] leading-4 text-tx-tertiary">
      {lead ? <span>{lead} </span> : null}
      wuup can make mistakes, so check important numbers.
    </p>
  );
}

export function Composer({ autoFocus = false, placeholder }: { autoFocus?: boolean; placeholder?: string }) {
  const ctx = useChatContext();
  const { chatId, entry, send, stop, research, setResearch, prefs, pendingBridgeIds, setPendingBridgeIds } = ctx;
  const researchOn = useFeature("research");
  const anyActive = useAnyStreamActive();
  const streamingHere = !!entry && isActivePhase(entry.phase);
  const stopping = streamingHere && !!entry?.stopRequested;
  const busyElsewhere = anyActive && !streamingHere;
  const chat = useChat(chatId);
  const updateScope = useUpdateChatScope();

  const [value, setValue] = React.useState("");
  const taRef = React.useRef<HTMLTextAreaElement>(null);
  const inputId = React.useId();
  const hintId = React.useId();

  // Load the draft of the chat we are on (the composer persists across chats).
  const [draftChat, setDraftChat] = React.useState<string | null | undefined>(undefined);
  React.useEffect(() => {
    if (draftChat === chatId) return;
    // Carrying over from /chat to the new /chat/:id keeps whatever is typed.
    if (draftChat === null && chatId) {
      setDraftChat(chatId);
      return;
    }
    setDraftChat(chatId);
    setValue(readDraft(chatId));
  }, [chatId, draftChat]);

  React.useEffect(() => {
    if (draftChat === undefined) return;
    writeDraft(draftChat, value);
  }, [value, draftChat]);

  // Autogrow up to MAX_HEIGHT.
  React.useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const h = Math.min(ta.scrollHeight, MAX_HEIGHT);
    ta.style.height = `${h}px`;
    ta.style.overflowY = ta.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
  }, [value]);

  React.useEffect(() => {
    if (autoFocus) taRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  // App-wide events: focus, research toggle, draft restore.
  React.useEffect(() => {
    const focus = () => taRef.current?.focus();
    const toggle = () => {
      if (researchOn) setResearch(!research);
    };
    const restore = (e: Event) => {
      const d = (e as CustomEvent<RestoreDraftDetail>).detail;
      if (d && (d.chatId === chatId || !chatId)) setValue((v) => v || d.content);
    };
    window.addEventListener(FOCUS_COMPOSER_EVENT, focus);
    window.addEventListener(TOGGLE_RESEARCH_EVENT, toggle);
    window.addEventListener(RESTORE_DRAFT_EVENT, restore);
    return () => {
      window.removeEventListener(FOCUS_COMPOSER_EVENT, focus);
      window.removeEventListener(TOGGLE_RESEARCH_EVENT, toggle);
      window.removeEventListener(RESTORE_DRAFT_EVENT, restore);
    };
  }, [chatId, research, researchOn, setResearch]);

  // Esc stops the running answer (unless a dialog or menu handled it).
  React.useEffect(() => {
    if (!streamingHere) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (document.querySelector('[role="dialog"], [role="menu"], [data-radix-popper-content-wrapper]')) return;
      stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [streamingHere, stop]);

  const meta = useMeta();
  const maxChars = meta.data?.limits.maxPromptChars ?? DEFAULT_MAX_PROMPT;
  const trimmed = value.trim();
  const tooLong = value.length > maxChars;
  const canSend = !!trimmed && !anyActive && !tooLong;

  const submit = async () => {
    if (!canSend) return;
    const text = value;
    setValue("");
    const ok = await send(text);
    if (!ok) setValue((v) => v || text);
    taRef.current?.focus({ preventScroll: true });
  };

  const scopeValue = chatId ? (chat.data?.bridgeIds ?? []) : pendingBridgeIds;
  const setScope = (ids: string[]) => {
    if (chatId) updateScope.mutate({ id: chatId, bridgeIds: ids });
    else setPendingBridgeIds(ids);
  };

  return (
    <div className="w-full">
      <form
        className={cn(
          "prompt mx-auto bg-white/60 p-2 backdrop-blur-xl sm:p-4",
          "shadow-[0_12px_40px_-16px_rgb(37_99_235/0.18)]",
        )}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        aria-label="Message composer"
      >
        <div
          className={cn(
            "prompt__inner flex flex-col gap-1 p-0 pb-2",
            "transition-[border-color,box-shadow] duration-200 ease-standard",
            "focus-within:border-indigo-300 focus-within:shadow-focus",
          )}
        >
          <label htmlFor={inputId} className="sr-only">
            Message wuup
          </label>
          <textarea
            id={inputId}
            ref={taRef}
            value={value}
            rows={1}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder={placeholder ?? (research ? "What should wuup research?" : "Ask about your data")}
            aria-describedby={hintId}
            enterKeyHint="send"
            spellCheck
            className="block max-h-[200px] min-h-[52px] w-full resize-none bg-transparent px-4 pb-1 pt-3.5 text-[16px] leading-[1.55] text-tx outline-none placeholder:text-tx-muted md:text-[16px]"
          />
          <span id={hintId} className="sr-only">
            Enter to send, Shift and Enter for a new line.
          </span>

          <div className="flex items-center gap-1 px-2.5">
            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
              <AttachMenu />
              <ScopePicker value={scopeValue} onChange={setScope} />
              <button
                type="button"
                aria-pressed={prefs.searchWeb}
                onClick={() => prefs.setSearchWeb(!prefs.searchWeb)}
                className={cn(toolChip, prefs.searchWeb ? toolChipOn : toolChipOff)}
              >
                <Globe className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
                <span className="max-sm:sr-only">Web</span>
              </button>
              {researchOn ? (
                <TooltipRoot delayDuration={300}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-pressed={research}
                      onClick={() => setResearch(!research)}
                      className={cn(toolChip, research ? toolChipOn : toolChipOff)}
                    >
                      <Telescope className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
                      <span className="max-sm:sr-only">Research</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Plans several steps and checks more sources. Takes longer.</TooltipContent>
                </TooltipRoot>
              ) : null}
            </div>

            <ModelPicker models={prefs.models} value={prefs.model} onChange={prefs.setModel} />

            {streamingHere ? (
              <button
                type="button"
                onClick={stop}
                aria-label={stopping ? "Stopping" : "Stop answering"}
                className="ml-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-white shadow-btn-ink transition-transform duration-150 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
              >
                <span className={cn("block size-3 rounded-[3px] bg-white", stopping && "animate-pulse")} aria-hidden="true" />
              </button>
            ) : (
              <button
                type="submit"
                aria-label="Send message"
                disabled={!canSend}
                title={busyElsewhere ? "Another chat is still answering" : undefined}
                className="ml-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-white shadow-btn-ink transition-[transform,opacity,background-color] duration-150 active:scale-[0.96] disabled:bg-sf-tertiary disabled:text-tx-muted disabled:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
              >
                <ArrowUp className="size-[18px]" strokeWidth={2} aria-hidden="true" />
              </button>
            )}
          </div>
          {tooLong ? (
            <p className="px-4 pb-1 text-[12px] text-red-400" role="alert">
              Messages are limited to {maxChars.toLocaleString("en-IN")} characters.
            </p>
          ) : null}
        </div>
      </form>
      <UsageLine />
    </div>
  );
}
