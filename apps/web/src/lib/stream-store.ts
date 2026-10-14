"use client";

import { useSyncExternalStore } from "react";
import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import { apiStream, api, ApiError, errorMessage } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { readSSE, isAbortError, StreamClosedError } from "@/lib/sse";
import { toast } from "@/components/ui/toast";
import { upsertMessages, type MessagesData } from "@/hooks/data/useMessages";
import type {
  ChatMode,
  ChatSummary,
  DonePayload,
  MessageDTO,
  Page,
  ResearchStep,
  Source,
  StatusCode,
  StreamEvent,
  ToolState,
} from "@/lib/types";

/*
 * Chat stream store.
 *
 * One entry per chat id (a stream can never write into another chat). The
 * thread renders `server messages + overlay`, where the overlay is the entry's
 * optimistic user message and live draft. Overlay items are hidden as soon as
 * the server list contains their ids, so a slow or stale GET can never wipe
 * the optimistic turn, and a finished turn never flickers.
 *
 * Switching chats does not stop a stream: it keeps running in the background
 * and the sidebar shows it through useStreamingChatIds().
 */

/** Abort a running stream when the user navigates to another chat. */
export const ABORT_ON_SWITCH = false;

/** How long a token batch may wait when requestAnimationFrame is throttled (background tab). */
const FLUSH_FALLBACK_MS = 100;

/** After POST /stop, how long to wait for the server's final `done` before dropping the connection. */
const STOP_GRACE_MS = 2500;

// ─── Types ───────────────────────────────────────────────────────────────────

export type StreamPhase = "connecting" | "thinking" | "streaming" | "done" | "error" | "aborted";

export interface StreamStatus {
  message: string;
  code?: StatusCode;
  at: number;
}

export interface StreamTool {
  id: string;
  name: string;
  label: string;
  state: ToolState;
  query?: string;
  at: number;
}

export interface StreamDraft {
  /** Stable render key of the assistant turn (kept after the server id arrives). */
  clientKey: string;
  content: string;
  statuses: StreamStatus[];
  steps: ResearchStep[];
  sources: Source[];
  /** Query texts of finished tool calls, in order. */
  queries: string[];
  tools: StreamTool[];
  startedAt: number;
  firstTokenAt: number | null;
}

export interface StreamError {
  code: string;
  message: string;
  retryable: boolean;
  status?: number;
  retryAfterS?: number;
}

export interface StreamOptions {
  content: string;
  model?: string;
  searchWeb?: boolean;
  mode?: ChatMode;
}

export interface StreamEntry {
  streamId: string;
  chatId: string;
  phase: StreamPhase;
  mode: ChatMode;
  /** The request, kept so "Try again" can resend it. */
  request: Omit<StreamOptions, "content"> & { content: string | null };
  /** Optimistic user message (null for a regenerate). */
  userMessage: MessageDTO | null;
  /** Stable render key of the user turn. */
  userKey: string | null;
  /** The assistant message a regenerate replaces. */
  replacesMessageId?: string;
  userMessageId?: string;
  assistantMessageId?: string;
  draft: StreamDraft;
  /** Server messages from `done` (or a saved partial answer from `error`). */
  final?: { userMessage: MessageDTO | null; assistantMessage: MessageDTO | null; followUpsFallback?: DonePayload["followUps"] };
  error?: StreamError;
  stopRequested?: boolean;
  endedAt?: number;
}

export type StreamAction =
  | { type: "META"; userMessageId: string; assistantMessageId: string; mode: ChatMode }
  | { type: "STATUS"; message: string; code?: StatusCode; at: number }
  | { type: "TOOL"; tool: Omit<StreamTool, "at">; at: number }
  | { type: "SOURCES"; sources: Source[] }
  | { type: "STEP"; step: ResearchStep }
  | { type: "APPEND"; text: string; at: number }
  | { type: "DONE"; payload: DonePayload; at: number }
  | { type: "ERROR"; error: StreamError; assistantMessage?: MessageDTO; at: number }
  | { type: "STOP_REQUESTED" }
  | { type: "ABORT"; at: number };

export const ACTIVE_PHASES: ReadonlySet<StreamPhase> = new Set(["connecting", "thinking", "streaming"]);

export function isActivePhase(phase: StreamPhase | undefined | null): boolean {
  return !!phase && ACTIVE_PHASES.has(phase);
}

// ─── Pure reducer ────────────────────────────────────────────────────────────

const MAX_STATUSES = 20;

function upsertBy<T>(list: T[], item: T, same: (a: T) => boolean): T[] {
  const at = list.findIndex(same);
  if (at === -1) return [...list, item];
  const next = list.slice();
  next[at] = item;
  return next;
}

/** Pure state transition for one stream entry. Unit tested. */
export function streamReducer(entry: StreamEntry, action: StreamAction): StreamEntry {
  const terminal = !isActivePhase(entry.phase);

  switch (action.type) {
    case "META": {
      if (terminal) return entry;
      return {
        ...entry,
        mode: action.mode,
        userMessageId: action.userMessageId,
        assistantMessageId: action.assistantMessageId,
        phase: entry.phase === "connecting" ? "thinking" : entry.phase,
      };
    }
    case "STATUS": {
      if (terminal) return entry;
      const statuses = [...entry.draft.statuses, { message: action.message, code: action.code, at: action.at }].slice(
        -MAX_STATUSES,
      );
      return {
        ...entry,
        phase: entry.phase === "connecting" ? "thinking" : entry.phase,
        draft: { ...entry.draft, statuses },
      };
    }
    case "TOOL": {
      if (terminal) return entry;
      const tool: StreamTool = { ...action.tool, at: action.at };
      const tools = upsertBy(entry.draft.tools, tool, (t) => t.id === tool.id);
      const queries =
        tool.state === "done" && tool.query && !entry.draft.queries.includes(tool.query)
          ? [...entry.draft.queries, tool.query]
          : entry.draft.queries;
      return {
        ...entry,
        phase: entry.phase === "connecting" ? "thinking" : entry.phase,
        draft: { ...entry.draft, tools, queries },
      };
    }
    case "SOURCES": {
      if (terminal) return entry;
      return { ...entry, draft: { ...entry.draft, sources: [...action.sources].sort((a, b) => a.n - b.n) } };
    }
    case "STEP": {
      if (terminal) return entry;
      const steps = upsertBy(entry.draft.steps, action.step, (s) => s.id === action.step.id);
      return {
        ...entry,
        phase: entry.phase === "connecting" ? "thinking" : entry.phase,
        draft: { ...entry.draft, steps },
      };
    }
    case "APPEND": {
      if (terminal || !action.text) return entry;
      return {
        ...entry,
        phase: "streaming",
        draft: {
          ...entry.draft,
          content: entry.draft.content + action.text,
          firstTokenAt: entry.draft.firstTokenAt ?? action.at,
        },
      };
    }
    case "DONE": {
      if (entry.phase === "done") return entry;
      const { userMessage, assistantMessage } = action.payload;
      return {
        ...entry,
        phase: assistantMessage.status === "stopped" ? "aborted" : "done",
        userMessageId: userMessage?.id ?? entry.userMessageId,
        assistantMessageId: assistantMessage.id,
        final: {
          userMessage: userMessage ?? null,
          assistantMessage,
          followUpsFallback: action.payload.followUps,
        },
        error: undefined,
        endedAt: action.at,
      };
    }
    case "ERROR": {
      if (entry.phase === "done") return entry;
      const aborted = action.error.code === "ABORTED";
      return {
        ...entry,
        phase: aborted ? "aborted" : "error",
        error: aborted ? undefined : action.error,
        assistantMessageId: action.assistantMessage?.id ?? entry.assistantMessageId,
        final: action.assistantMessage
          ? { userMessage: null, assistantMessage: action.assistantMessage }
          : entry.final,
        endedAt: action.at,
      };
    }
    case "STOP_REQUESTED": {
      if (terminal) return entry;
      return { ...entry, stopRequested: true };
    }
    case "ABORT": {
      if (terminal) return entry;
      return { ...entry, phase: "aborted", endedAt: action.at };
    }
  }
}

let seq = 0;
function newId(prefix: string) {
  seq += 1;
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${seq}-${rand}`;
}

/** A client-side user message shown until the server has the real one. */
export function optimisticUserMessage(chatId: string, content: string, mode: ChatMode, id: string): MessageDTO {
  return {
    id,
    _id: id,
    chatId,
    parentId: null,
    role: "user",
    content,
    status: "complete",
    mode,
    createdAt: new Date().toISOString(),
    visualType: "none",
    chartData: null,
    tableData: null,
    diagramData: null,
    followUps: [],
    clarification: null,
    sources: [],
    queries: [],
    research: null,
    model: null,
    metrics: null,
    feedback: null,
    error: null,
  };
}

/**
 * A displayable assistant message for a stream that ended without a saved
 * server message (stopped, or failed before saving). Its id is the server id
 * from `start` when known, else a "local-" id.
 */
export function draftToMessage(entry: StreamEntry): MessageDTO {
  const id = entry.assistantMessageId ?? `local-${entry.streamId}`;
  const base = optimisticUserMessage(entry.chatId, entry.draft.content, entry.mode, id);
  return {
    ...base,
    role: "assistant",
    parentId: entry.userMessageId ?? null,
    status: entry.phase === "aborted" ? "stopped" : entry.phase === "error" ? "error" : "complete",
    sources: entry.draft.sources,
    research: entry.draft.steps.length
      ? { steps: entry.draft.steps, durationMs: (entry.endedAt ?? Date.now()) - entry.draft.startedAt }
      : null,
    error:
      entry.phase === "error" && entry.error
        ? { code: (entry.error.code as NonNullable<MessageDTO["error"]>["code"]) ?? "INTERNAL", message: entry.error.message }
        : null,
  };
}

export function createEntry(
  chatId: string,
  opts: StreamOptions & { replacesMessageId?: string; now?: number },
): StreamEntry {
  const streamId = newId("s");
  const mode = opts.mode ?? "chat";
  const isRegenerate = !!opts.replacesMessageId;
  const userKey = isRegenerate ? null : `u-${streamId}`;
  return {
    streamId,
    chatId,
    phase: "connecting",
    mode,
    request: { content: isRegenerate ? null : opts.content, model: opts.model, searchWeb: opts.searchWeb, mode },
    userMessage: isRegenerate ? null : optimisticUserMessage(chatId, opts.content, mode, `local-${streamId}`),
    userKey,
    replacesMessageId: opts.replacesMessageId,
    draft: {
      clientKey: `a-${streamId}`,
      content: "",
      statuses: [],
      steps: [],
      sources: [],
      queries: [],
      tools: [],
      startedAt: opts.now ?? Date.now(),
      firstTokenAt: null,
    },
  };
}

// ─── Render keys (server id -> client key, so nothing remounts) ──────────────

const renderKeys = new Map<string, string>();

/** Stable React key for a message: the client key it streamed under, else its id. */
export function renderKeyFor(messageId: string): string {
  return renderKeys.get(messageId) ?? messageId;
}

// ─── Store ───────────────────────────────────────────────────────────────────

const entries = new Map<string, StreamEntry>();
const controllers = new Map<string, AbortController>();
const listeners = new Set<() => void>();
let creating = 0;
let activeIds: string[] = [];

function recomputeActive() {
  const next = [...entries.values()].filter((e) => isActivePhase(e.phase)).map((e) => e.chatId);
  if (next.length !== activeIds.length || next.some((id, i) => id !== activeIds[i])) activeIds = next;
}

function emit() {
  recomputeActive();
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setEntry(chatId: string, entry: StreamEntry | null) {
  if (entry) entries.set(chatId, entry);
  else entries.delete(chatId);
  emit();
}

function dispatch(chatId: string, streamId: string, action: StreamAction) {
  const current = entries.get(chatId);
  if (!current || current.streamId !== streamId) return;
  const next = streamReducer(current, action);
  if (next !== current) setEntry(chatId, next);
}

let queryClient: QueryClient | null = null;

/** Called once by the chat screen so finished turns can be written to the query cache. */
export function bindQueryClient(qc: QueryClient) {
  queryClient = qc;
}

// ─── Cache writers ───────────────────────────────────────────────────────────

type ChatsList = InfiniteData<Page<ChatSummary>, string | null>;

function patchChatCaches(chatId: string, patch: Partial<ChatSummary>, moveToTop = false) {
  const qc = queryClient;
  if (!qc) return;
  qc.setQueryData<ChatSummary>(qk.chats.detail(chatId), (old) => (old ? { ...old, ...patch } : old));
  qc.setQueryData<ChatsList>(qk.chats.list, (old) => {
    if (!old?.pages) return old;
    let found: ChatSummary | undefined;
    for (const p of old.pages) found ??= p.items.find((c) => c.id === chatId);
    if (!found) return old;
    const updated: ChatSummary = { ...found, ...patch };
    if (!moveToTop) {
      return {
        ...old,
        pages: old.pages.map((p) => ({ ...p, items: p.items.map((c) => (c.id === chatId ? updated : c)) })),
      };
    }
    const pages = old.pages.map((p) => ({ ...p, items: p.items.filter((c) => c.id !== chatId) }));
    pages[0] = { ...pages[0], items: [updated, ...pages[0].items] };
    return { ...old, pages };
  });
}

/** Adds a freshly created chat to the sidebar list and seeds its caches. */
export function seedNewChat(chat: ChatSummary) {
  const qc = queryClient;
  if (!qc) return;
  qc.setQueryData(qk.chats.detail(chat.id), chat);
  qc.setQueryData<MessagesData>(qk.messages(chat.id), { items: [], nextCursor: null });
  qc.setQueryData<ChatsList>(qk.chats.list, (old) => {
    if (!old?.pages?.length) return old;
    if (old.pages.some((p) => p.items.some((c) => c.id === chat.id))) return old;
    const [first, ...rest] = old.pages;
    return { ...old, pages: [{ ...first, items: [chat, ...first.items] }, ...rest] };
  });
}

async function writeTurn(chatId: string, messages: MessageDTO[], remove: string[] = []) {
  const qc = queryClient;
  if (!qc) return;
  // Cancel (and wait for) an in-flight GET first: a cancelled fetch reverts the
  // cache, which would otherwise undo the write below.
  await qc.cancelQueries({ queryKey: qk.messages(chatId), exact: true });
  qc.setQueryData<MessagesData>(qk.messages(chatId), (old) => upsertMessages(old, messages, remove));
}

function refetchMessagesSoon(chatId: string, delay = 600) {
  const qc = queryClient;
  if (!qc) return;
  setTimeout(() => {
    void qc.invalidateQueries({ queryKey: qk.messages(chatId), exact: true });
  }, delay);
}

// ─── Token batching ──────────────────────────────────────────────────────────

function createTokenBuffer(onFlush: (text: string) => void) {
  let pending = "";
  let raf: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    if (raf !== null && typeof cancelAnimationFrame !== "undefined") cancelAnimationFrame(raf);
    if (timer !== null) clearTimeout(timer);
    raf = null;
    timer = null;
  };

  const flush = () => {
    cancel();
    if (!pending) return;
    const text = pending;
    pending = "";
    onFlush(text);
  };

  return {
    push(text: string) {
      pending += text;
      if (raf !== null || timer !== null) return;
      if (typeof requestAnimationFrame !== "undefined") raf = requestAnimationFrame(flush);
      // rAF does not fire in background tabs; the timer keeps those streams moving.
      timer = setTimeout(flush, FLUSH_FALLBACK_MS);
    },
    flush,
    dispose: cancel,
  };
}

// ─── Running a stream ────────────────────────────────────────────────────────

const RESTORE_DRAFT_EVENT = "wuup:restore-draft";

export interface RestoreDraftDetail {
  chatId: string;
  content: string;
}

function restoreDraft(chatId: string, content: string | null) {
  if (!content || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<RestoreDraftDetail>(RESTORE_DRAFT_EVENT, { detail: { chatId, content } }));
}

export { RESTORE_DRAFT_EVENT };

function toStreamError(err: unknown): StreamError {
  if (err instanceof ApiError) {
    return {
      code: String(err.code),
      message: err.message,
      retryable: err.status === 0 || err.status >= 500 || err.code === "RATE_LIMITED",
      status: err.status,
      retryAfterS: err.retryAfterS,
    };
  }
  if (err instanceof StreamClosedError) {
    return { code: "CONNECTION_LOST", message: "Connection lost before the answer finished.", retryable: true };
  }
  return { code: "INTERNAL", message: errorMessage(err), retryable: true };
}

async function run(entry: StreamEntry, path: string, body: Record<string, unknown>) {
  const { chatId, streamId } = entry;
  const controller = new AbortController();
  controllers.set(chatId, controller);
  const act = (action: StreamAction) => dispatch(chatId, streamId, action);
  const buffer = createTokenBuffer((text) => act({ type: "APPEND", text, at: Date.now() }));

  const handle = (ev: StreamEvent) => {
    const now = Date.now();
    if (ev.type === "token") {
      buffer.push(ev.text);
      return;
    }
    // Every other event keeps its order relative to the text.
    buffer.flush();
    switch (ev.type) {
      case "start": {
        const cur = entries.get(chatId);
        if (cur?.streamId === streamId) {
          if (cur.userKey) renderKeys.set(ev.userMessageId, cur.userKey);
          renderKeys.set(ev.assistantMessageId, cur.draft.clientKey);
        }
        act({ type: "META", userMessageId: ev.userMessageId, assistantMessageId: ev.assistantMessageId, mode: ev.mode });
        break;
      }
      case "status":
        act({ type: "STATUS", message: ev.message, code: ev.code, at: now });
        break;
      case "tool":
        act({ type: "TOOL", tool: { id: ev.id, name: ev.name, label: ev.label, state: ev.state, query: ev.query }, at: now });
        break;
      case "sources":
        act({ type: "SOURCES", sources: ev.sources });
        break;
      case "step":
        act({ type: "STEP", step: ev.step });
        break;
      case "title":
        patchChatCaches(ev.chatId || chatId, { title: ev.title });
        break;
      case "done":
        onDone(chatId, streamId, ev.message, now);
        break;
      case "error":
        onError(chatId, streamId, ev, now);
        break;
    }
  };

  try {
    const res = await apiStream(path, { json: body, signal: controller.signal });
    await readSSE(res, handle, controller.signal);
  } catch (err) {
    buffer.flush();
    if (isAbortError(err)) {
      act({ type: "ABORT", at: Date.now() });
      refetchMessagesSoon(chatId);
    } else if (err instanceof ApiError && err.code === "CHAT_BUSY") {
      // The server is still answering in this chat (another tab): drop the turn.
      const cur = entries.get(chatId);
      if (cur?.streamId === streamId) setEntry(chatId, null);
      restoreDraft(chatId, entry.request.content);
      toast("wuup is still answering in this chat", {
        description: "Wait for that answer to finish, then send again.",
      });
    } else {
      act({ type: "ERROR", error: toStreamError(err), at: Date.now() });
      if (err instanceof ApiError && err.code === "MODEL_UNAVAILABLE" && queryClient) {
        void queryClient.invalidateQueries({ queryKey: qk.models });
      }
      const cur = entries.get(chatId);
      if (cur?.userMessageId) refetchMessagesSoon(chatId);
    }
  } finally {
    buffer.dispose();
    if (controllers.get(chatId) === controller) controllers.delete(chatId);
  }
}

function onDone(chatId: string, streamId: string, payload: DonePayload, at: number) {
  const before = entries.get(chatId);
  if (!before || before.streamId !== streamId) return;
  const assistant: MessageDTO = {
    ...payload.assistantMessage,
    followUps: payload.assistantMessage.followUps?.length ? payload.assistantMessage.followUps : payload.followUps ?? [],
    clarification: payload.assistantMessage.clarification ?? payload.clarification ?? null,
  };
  const user = payload.userMessage;
  if (before.userKey && user?.id) renderKeys.set(user.id, before.userKey);
  renderKeys.set(assistant.id, before.draft.clientKey);
  dispatch(chatId, streamId, { type: "DONE", payload: { ...payload, assistantMessage: assistant }, at });

  const remove = before.replacesMessageId && before.replacesMessageId !== assistant.id ? [before.replacesMessageId] : [];
  void writeTurn(chatId, user ? [user, assistant] : [assistant], remove);

  patchChatCaches(chatId, { lastMessageAt: assistant.createdAt ?? new Date(at).toISOString() }, true);
  const qc = queryClient;
  if (qc) {
    void qc.invalidateQueries({ queryKey: qk.usage });
    if (payload.exhausted?.length) void qc.invalidateQueries({ queryKey: qk.models });
  }
}

function onError(
  chatId: string,
  streamId: string,
  ev: Extract<StreamEvent, { type: "error" }>,
  at: number,
) {
  const before = entries.get(chatId);
  if (!before || before.streamId !== streamId) return;
  const assistant = ev.assistantMessage;
  if (assistant) renderKeys.set(assistant.id, before.draft.clientKey);
  dispatch(chatId, streamId, {
    type: "ERROR",
    error: { code: ev.code, message: ev.message, retryable: ev.retryable },
    assistantMessage: assistant,
    at,
  });
  const after = entries.get(chatId);
  if (assistant && after) {
    // Write the saved partial answer together with its question so the order holds.
    const user =
      before.userMessage && after.userMessageId
        ? { ...before.userMessage, id: after.userMessageId, _id: after.userMessageId }
        : null;
    const remove = before.replacesMessageId && before.replacesMessageId !== assistant.id ? [before.replacesMessageId] : [];
    void writeTurn(chatId, user ? [user, assistant] : [assistant], remove);
  }
  if (after?.userMessageId) refetchMessagesSoon(chatId, 1200);
  const qc = queryClient;
  if (qc && ev.code === "FREE_LIMIT_REACHED") void qc.invalidateQueries({ queryKey: qk.usage });
}

// ─── Public API ──────────────────────────────────────────────────────────────

export type StartResult = { ok: true; streamId: string } | { ok: false; reason: "busy" | "empty" };

function anyActive(): boolean {
  if (creating > 0) return true;
  for (const e of entries.values()) if (isActivePhase(e.phase)) return true;
  return false;
}

function start(chatId: string, opts: StreamOptions): StartResult {
  const content = opts.content.trim();
  if (!content) return { ok: false, reason: "empty" };
  if (anyActive()) return { ok: false, reason: "busy" };
  const entry = createEntry(chatId, { ...opts, content });
  setEntry(chatId, entry);
  const qc = queryClient;
  if (qc) void qc.cancelQueries({ queryKey: qk.messages(chatId), exact: true });
  void run(entry, `/chats/${encodeURIComponent(chatId)}/messages`, {
    content,
    mode: entry.mode,
    ...(opts.model && opts.model !== "auto" ? { model: opts.model } : {}),
    ...(opts.searchWeb !== undefined ? { searchWeb: opts.searchWeb } : {}),
  });
  return { ok: true, streamId: entry.streamId };
}

function regenerate(
  chatId: string,
  assistantMessageId: string,
  opts: Omit<StreamOptions, "content"> = {},
): StartResult {
  if (anyActive()) return { ok: false, reason: "busy" };
  const entry = createEntry(chatId, { ...opts, content: "", replacesMessageId: assistantMessageId });
  setEntry(chatId, entry);
  const qc = queryClient;
  if (qc) {
    // The old answer leaves the list while the new one streams in its place.
    void (async () => {
      await qc.cancelQueries({ queryKey: qk.messages(chatId), exact: true });
      qc.setQueryData<MessagesData>(qk.messages(chatId), (old) =>
        old ? { ...old, items: old.items.filter((m) => m.id !== assistantMessageId) } : old,
      );
    })();
  }
  void run(
    entry,
    `/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(assistantMessageId)}/regenerate`,
    {
      mode: entry.mode,
      ...(opts.model && opts.model !== "auto" ? { model: opts.model } : {}),
      ...(opts.searchWeb !== undefined ? { searchWeb: opts.searchWeb } : {}),
    },
  );
  return { ok: true, streamId: entry.streamId };
}

function stop(chatId: string) {
  const entry = entries.get(chatId);
  if (!entry || !isActivePhase(entry.phase)) return;
  if (entry.stopRequested) {
    // Second press: stop waiting for the server.
    controllers.get(chatId)?.abort();
    return;
  }
  dispatch(chatId, entry.streamId, { type: "STOP_REQUESTED" });
  const controller = controllers.get(chatId);
  const abortNow = () => {
    const cur = entries.get(chatId);
    if (cur?.streamId === entry.streamId && isActivePhase(cur.phase)) controller?.abort();
  };
  // The server saves the partial answer and ends the stream with a normal
  // `done` (status "stopped"). If that does not arrive soon (or the stop
  // request itself fails or hangs), drop the connection.
  const timer = setTimeout(abortNow, STOP_GRACE_MS);
  void api(`/chats/${encodeURIComponent(chatId)}/stop`, { method: "POST" }).catch(() => {
    clearTimeout(timer);
    abortNow();
  });
}

function abortAll() {
  for (const [chatId, c] of controllers) {
    c.abort();
    controllers.delete(chatId);
  }
}

/** Removes a finished entry (e.g. after "Try again" or when dismissing an error). */
function clear(chatId: string) {
  const entry = entries.get(chatId);
  if (entry && !isActivePhase(entry.phase)) setEntry(chatId, null);
}

/** Marks a new-chat creation in flight so concurrent sends are rejected. */
function beginCreate(): boolean {
  if (anyActive()) return false;
  creating += 1;
  emit();
  return true;
}

function endCreate() {
  creating = Math.max(0, creating - 1);
  emit();
}

function get(chatId: string): StreamEntry | null {
  return entries.get(chatId) ?? null;
}

export const streamStore = {
  start,
  regenerate,
  stop,
  abortAll,
  anyActive,
  clear,
  get,
  beginCreate,
  endCreate,
  subscribe,
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

const EMPTY: string[] = [];

/** The stream entry of one chat (live, finished or failed), or null. */
export function useStreamEntry(chatId: string | null | undefined): StreamEntry | null {
  return useSyncExternalStore(
    subscribe,
    () => (chatId ? entries.get(chatId) ?? null : null),
    () => null,
  );
}

/** Ids of chats with a stream in progress (for the sidebar's live dots). */
export function useStreamingChatIds(): string[] {
  return useSyncExternalStore(
    subscribe,
    () => activeIds,
    () => EMPTY,
  );
}

/** True while any chat is streaming or a new chat is being created. */
export function useAnyStreamActive(): boolean {
  return useSyncExternalStore(subscribe, anyActive, () => false);
}
