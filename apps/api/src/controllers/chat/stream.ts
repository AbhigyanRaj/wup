import type { Request, Response } from "express";
import mongoose from "mongoose";
import { AUTO_MODEL_ID, LIMITS, type ChatMode, type ErrorCode, type RegenerateBody, type SendMessageBody } from "@wup/contracts";
import { Chat, Message, User } from "@wup/models";
import { DEFAULT_CHAT_TITLES, isDefaultTitle } from "../../dto/chat";
import { toMessageDTO } from "../../dto/message";
import { acquireChat, stopChat } from "../../lib/inflight";
import { openSse, type SseStream } from "../../lib/sse";
import { ensureAnswerContent, persistAssistant } from "./persist";
import {
  HttpError,
  asyncHandler,
  env,
  getRequestId,
  getUsageSnapshot,
  getUserId,
  httpError,
  isErrorCode,
  localHeuristicTitle,
  notFound,
  recordUsage,
  reserveQuota,
  resolveBrain,
  resolveLlmCredentials,
  settleQuota,
  validateRequestedModel,
  type BrainEmitEvent,
  type BrainHistoryTurn,
  type BrainResult,
  type ChatBrain,
  type LlmCredentials,
  type QuotaReservation,
} from "./deps";

/**
 * POST /chats/:chatId/messages                          (send, SSE)
 * POST /chats/:chatId/messages/:messageId/regenerate    (SSE)
 * POST /chats/:chatId/stop
 *
 * Event sequence on the stream:
 *   start -> (status | tool | sources | step | token)* -> title? -> done
 *   start -> ... -> title? -> done             (also after a stop: assistantMessage.status "stopped")
 *   start -> ... -> title? -> error            (real failures only)
 * Everything that can fail with a JSON error (validation, ownership, busy chat,
 * model, free-tier quota) happens before the stream opens.
 */

const HISTORY_LIMIT = 10;
const TITLE_WAIT_MS = 2_000;
const TITLE_HARD_TIMEOUT_MS = 20_000;

/** Brain events forwarded to the client unchanged. */
const FORWARDED_EVENTS = new Set(["status", "token", "tool", "sources", "step"]);

const RETRYABLE_CODES = new Set<ErrorCode>([
  "PROVIDER_ERROR",
  "MODEL_UNAVAILABLE",
  "RATE_LIMITED",
  "INTERNAL",
  "BRIDGE_UNREACHABLE",
  "ABORTED",
]);

const DEFAULT_ERROR_MESSAGES: Partial<Record<ErrorCode, string>> = {
  PROVIDER_ERROR: "The model could not answer right now. Please try again.",
  PROVIDER_AUTH: "Your API key was rejected by the provider. Check it in Settings.",
  MODEL_UNAVAILABLE: "That model is not available right now. Try another model.",
  RATE_LIMITED: "The model is busy right now. Please try again in a moment.",
  INTERNAL: "Something went wrong while answering. Please try again.",
};

const isRecord = (v: unknown): v is Record<string, any> => typeof v === "object" && v !== null && !Array.isArray(v);

async function loadOwnedChat(chatId: string, userId: string): Promise<any> {
  const chat = await Chat.findOne({ _id: chatId, userId }).lean();
  if (!chat) throw notFound("Chat");
  return chat;
}

function assertModeAllowed(mode: ChatMode) {
  if (mode === "research" && !env.RESEARCH_ENABLED) {
    throw httpError(400, "VALIDATION_FAILED", "Deep research is not available yet.", {
      details: [{ path: "mode", message: "Deep research is not available yet." }],
    });
  }
}

// ─── Titles ───────────────────────────────────────────────────────────────────

function cleanTitle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw
    .replace(/\s+/g, " ")
    .replace(/^["'`*#\s]+|["'`*\s]+$/g, "")
    .trim()
    .slice(0, LIMITS.maxChatTitle)
    .trim();
  return t || null;
}

interface TitleJob {
  /** Resolves with the saved title, or null when it is not ready within `ms`. */
  wait(ms: number): Promise<string | null>;
}

function startTitleJob(
  brain: ChatBrain,
  chatId: string,
  userId: string,
  prompt: string,
  llm: LlmCredentials,
  parentSignal: AbortSignal
): TitleJob {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  parentSignal.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => ctrl.abort(), TITLE_HARD_TIMEOUT_MS);
  timer.unref?.();

  const job = (async (): Promise<string | null> => {
    let title: string | null = null;
    try {
      if (typeof brain.generateTitle === "function") title = cleanTitle(await brain.generateTitle(prompt, llm, ctrl.signal));
    } catch {
      title = null;
    }
    if (!title) {
      try {
        title = cleanTitle(typeof brain.heuristicTitle === "function" ? brain.heuristicTitle(prompt) : localHeuristicTitle(prompt));
      } catch {
        title = cleanTitle(localHeuristicTitle(prompt));
      }
    }
    if (!title) return null;
    // Never overwrite a title the user set in the meantime.
    const r = await Chat.updateOne(
      { _id: chatId, userId, $or: [{ titleSource: "auto" }, { title: { $in: DEFAULT_CHAT_TITLES } }] },
      { $set: { title, titleSource: "auto" } }
    );
    return r.matchedCount > 0 ? title : null;
  })()
    .catch((err) => {
      console.error("[wuup api] title generation failed:", err?.message ?? err);
      return null;
    })
    .finally(() => {
      clearTimeout(timer);
      parentSignal.removeEventListener("abort", onAbort);
    });

  return {
    wait(ms) {
      let t: NodeJS.Timeout | undefined;
      const timeout = new Promise<null>((resolve) => {
        t = setTimeout(() => resolve(null), ms);
      });
      return Promise.race([job, timeout]).finally(() => clearTimeout(t));
    },
  };
}

async function shouldAutoTitle(chat: any, userMessageId: unknown): Promise<boolean> {
  if (!(chat.titleSource === "auto" || isDefaultTitle(chat.title))) return false;
  const count =
    typeof chat.messageCount === "number"
      ? chat.messageCount
      : await Message.countDocuments({ chatId: chat._id, _id: { $ne: userMessageId } });
  return count === 0;
}

// ─── History ──────────────────────────────────────────────────────────────────

async function loadHistory(chatId: string, userMessage: any): Promise<{ history: BrainHistoryTurn[]; previousWasClarification: boolean }> {
  const docs: any[] = await Message.find({
    chatId,
    status: { $ne: "error" },
    _id: { $ne: userMessage._id },
    role: { $in: ["user", "assistant"] },
    createdAt: { $lte: userMessage.createdAt ?? new Date() },
  })
    .sort({ createdAt: -1, _id: -1 })
    .limit(HISTORY_LIMIT)
    .select("role content clarification")
    .lean();
  docs.reverse();

  const lastAssistant = [...docs].reverse().find((d) => d.role === "assistant");
  const c = lastAssistant?.clarification;
  const previousWasClarification = Boolean(
    c && (typeof c.question === "string" && c.question.trim() ? true : Array.isArray(c.options) && c.options.length > 0)
  );
  const history = docs
    .filter((d) => typeof d.content === "string" && d.content.trim())
    .map((d) => ({ role: d.role as "user" | "assistant", content: d.content }));
  return { history, previousWasClarification };
}

function brainPreferences(p: any) {
  if (!p || typeof p !== "object") return undefined;
  return {
    aboutMe: p.aboutMe || undefined,
    responseStyle: p.responseStyle || undefined,
    customInstructions: p.customInstructions || undefined,
    preferTables: typeof p.preferTables === "boolean" ? p.preferTables : undefined,
  };
}

// ─── The turn ─────────────────────────────────────────────────────────────────

interface Failure {
  code: ErrorCode;
  message: string;
  retryable: boolean;
}

function toFailure(result: BrainResult | null, thrown: unknown): Failure {
  const e = result?.error;
  const t = thrown as any;
  const code: ErrorCode = isErrorCode(e?.code) ? e!.code as ErrorCode : isErrorCode(t?.code) ? t.code : thrown ? "INTERNAL" : "PROVIDER_ERROR";
  const fromResult = typeof e?.message === "string" && e.message.trim() ? e.message.trim() : null;
  // Only HttpError messages are written for users; raw exceptions may leak internals.
  const fromThrown = thrown instanceof HttpError ? thrown.message : null;
  const message = fromResult ?? fromThrown ?? DEFAULT_ERROR_MESSAGES[code] ?? DEFAULT_ERROR_MESSAGES.INTERNAL!;
  const retryable = typeof e?.retryable === "boolean" ? e.retryable : RETRYABLE_CODES.has(code);
  return { code, message, retryable };
}

function countToolCalls(v: unknown): number {
  if (Array.isArray(v)) return v.length;
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

interface TurnContext {
  req: Request;
  res: Response;
  controller: AbortController;
  brain: ChatBrain;
  chat: any;
  userId: string;
  user: any;
  mode: ChatMode;
  model: string | undefined;
  searchWeb: boolean | undefined;
  llm: LlmCredentials;
  reservation: QuotaReservation;
  userMessage: any;
  prompt: string;
  /** Messages this turn adds to chat.messageCount (2 for a send, 1 for a regenerate). */
  newMessages: number;
  startedAt: number;
}

/** Runs one generation over SSE. Never throws once the stream is open. */
async function runTurn(c: TurnContext): Promise<void> {
  const chatId = String(c.chat._id);
  const assistantId = new mongoose.Types.ObjectId();
  const sse: SseStream = openSse(c.res, { controller: c.controller });
  const signal = sse.signal;

  try {
    const userMessageDTO = toMessageDTO(c.userMessage);
    sse.send({
      type: "start",
      chatId,
      userMessageId: userMessageDTO.id,
      assistantMessageId: assistantId.toHexString(),
      mode: c.mode,
      requestId: getRequestId(c.req) ?? assistantId.toHexString(),
    });

    let partial = "";
    let liveSources: unknown[] = [];
    const liveSteps = new Map<string, unknown>();
    let firstTokenAt: number | null = null;
    let result: BrainResult | null = null;
    let thrown: unknown = null;
    let title: TitleJob | null = null;
    const runStartedAt = Date.now();

    try {
      const { history, previousWasClarification } = await loadHistory(chatId, c.userMessage);
      if (await shouldAutoTitle(c.chat, c.userMessage._id)) {
        title = startTitleJob(c.brain, chatId, c.userId, c.prompt, c.llm, signal);
      }

      const emit = (ev: BrainEmitEvent) => {
        if (!isRecord(ev) || typeof ev.type !== "string") return;
        if (ev.type === "token" && typeof ev.text === "string") {
          if (firstTokenAt == null) firstTokenAt = Date.now();
          partial += ev.text;
        } else if (ev.type === "sources" && Array.isArray(ev.sources)) {
          liveSources = ev.sources;
        } else if (ev.type === "step" && isRecord(ev.step)) {
          liveSteps.set(String(ev.step.id ?? liveSteps.size), ev.step);
        }
        if (FORWARDED_EVENTS.has(ev.type)) sse.send(ev);
      };

      result = await c.brain.run(
        {
          userId: c.userId,
          prompt: c.prompt,
          mode: c.mode,
          history,
          model: c.model,
          // Research mode always searches the web (when web search is enabled server-side).
          searchWeb: env.WEB_SEARCH_ENABLED && (c.mode === "research" || !!c.searchWeb),
          bridgeIds: (Array.isArray(c.chat.bridgeIds) ? c.chat.bridgeIds : []).map((b: unknown) => String(b)),
          llm: c.llm,
          preferences: brainPreferences(c.user?.preferences),
          previousWasClarification,
        },
        { emit, signal }
      );
      if (!isRecord(result)) result = null;
    } catch (err) {
      thrown = err;
      if (!signal.aborted) console.error("[wuup api] brain run failed:", (err as any)?.message ?? err);
    }

    // ── Outcome ────────────────────────────────────────────────────────────
    let status: "complete" | "stopped" | "error";
    let failure: Failure | null = null;
    if (signal.aborted || result?.outcome === "stopped") {
      status = "stopped";
    } else if (thrown || !result || result.outcome === "error" || (!result.outcome && result.error)) {
      status = "error";
      failure = toFailure(result, thrown);
    } else {
      status = "complete";
    }

    const resultContent = typeof result?.content === "string" ? result.content : "";
    // Never store or send an empty complete answer (the brain guarantees it; this is the safety net).
    const answer = ensureAnswerContent(status, status === "complete" ? resultContent : resultContent || partial, result);
    const content = answer.content;

    const metrics = {
      latencyMs: Date.now() - c.startedAt,
      firstTokenMs:
        typeof result?.firstTokenMs === "number" ? result.firstTokenMs : firstTokenAt != null ? firstTokenAt - runStartedAt : null,
      tokensIn: typeof result?.usage?.tokensIn === "number" ? result.usage.tokensIn : null,
      tokensOut: typeof result?.usage?.tokensOut === "number" ? result.usage.tokensOut : null,
      toolCalls: countToolCalls(result?.toolCalls),
    };

    // ── Persist ────────────────────────────────────────────────────────────
    let assistantDoc: any = null;
    try {
      assistantDoc = await persistAssistant({
        _id: assistantId,
        chatId,
        userId: c.userId,
        parentId: c.userMessage._id,
        mode: c.mode,
        status,
        content,
        result,
        liveSources,
        liveSteps: [...liveSteps.values()],
        error: failure ? { code: failure.code, message: failure.message } : null,
        metrics,
      });
    } catch (err: any) {
      console.error("[wuup api] could not save the assistant message:", err?.message ?? err);
    }

    try {
      await Chat.updateOne(
        { _id: chatId },
        { $set: { lastMessageAt: new Date() }, $inc: { messageCount: c.newMessages - (assistantDoc ? 0 : 1) } }
      );
    } catch (err: any) {
      console.error("[wuup api] could not update the chat:", err?.message ?? err);
    }

    // ── Usage and quota ────────────────────────────────────────────────────
    const producedOutput = answer.refund
      ? false
      : typeof result?.producedOutput === "boolean"
        ? result.producedOutput
        : status !== "error" && content.length > 0;
    if (result) {
      await recordUsage(c.userId, {
        mode: c.mode,
        tokensIn: metrics.tokensIn ?? 0,
        tokensOut: metrics.tokensOut ?? 0,
        provider: result.model?.provider ?? c.llm.provider,
      }).catch((err) => console.error("[wuup api] recordUsage failed:", err?.message ?? err));
    }
    await settleQuota(c.reservation, producedOutput).catch((err) =>
      console.error("[wuup api] settleQuota failed:", err?.message ?? err)
    );

    // ── Final events ───────────────────────────────────────────────────────
    if (title && !sse.closed) {
      const t = await title.wait(TITLE_WAIT_MS);
      if (t) sse.send({ type: "title", chatId, title: t });
    }

    const assistantMessage = assistantDoc ? toMessageDTO(assistantDoc) : undefined;

    // A stopped turn is a normal end: `done` with assistantMessage.status "stopped"
    // and the partial content. `error` is only for real failures.
    if ((status === "complete" || status === "stopped") && assistantMessage) {
      sse.send({
        type: "done",
        message: {
          userMessage: userMessageDTO,
          assistantMessage,
          followUps: assistantMessage.followUps,
          clarification: assistantMessage.clarification,
          usedModel: result?.model?.id ?? null,
          exhausted: Array.isArray(result?.exhausted) ? result!.exhausted : [],
          usage: await getUsageSnapshot(c.userId),
        },
      });
    } else {
      const f = failure ?? toFailure(null, new Error("persist failed"));
      sse.send({
        type: "error",
        code: f.code,
        message: f.message,
        retryable: f.retryable,
        ...(assistantMessage ? { assistantMessage } : {}),
      });
    }
  } catch (err: any) {
    console.error("[wuup api] chat stream failed:", err?.message ?? err);
    sse.send({ type: "error", code: "INTERNAL", message: DEFAULT_ERROR_MESSAGES.INTERNAL!, retryable: true });
  } finally {
    sse.end();
  }
}

// ─── Shared entry ─────────────────────────────────────────────────────────────

interface TurnPlan {
  prompt: string;
  mode: ChatMode;
  newMessages: number;
  /** Writes the turn's user-side changes (after quota is reserved); returns the user message. */
  commit(): Promise<any>;
}

async function startTurn(
  req: Request,
  res: Response,
  o: {
    chat: any;
    userId: string;
    model: string | undefined;
    searchWeb: boolean | undefined;
    /** Runs while the chat is locked, before any quota is spent. */
    plan(): Promise<TurnPlan>;
  }
): Promise<void> {
  const startedAt = Date.now();
  const chatId = String(o.chat._id);
  const lease = acquireChat(chatId, o.userId);
  if (!lease) {
    throw httpError(409, "CHAT_BUSY", "This chat is still answering. Wait for it to finish or stop it first.", {
      retryAfterS: 2,
    });
  }
  try {
    const plan = await o.plan();
    assertModeAllowed(plan.mode);

    const user: any = await User.findById(o.userId).lean();
    if (!user) throw httpError(401, "UNAUTHENTICATED", "Please sign in again.");

    const brain = resolveBrain(req);
    // "auto" (also the legacy "Auto-Rotate") means: let the brain route.
    const validated = validateRequestedModel(user, o.model);
    const model = validated && validated !== AUTO_MODEL_ID ? validated : undefined;
    const cost = plan.mode === "research" ? env.RESEARCH_COST : 1;
    // Before any SSE output, so a spent free tier is a plain JSON 429.
    const reservation = await reserveQuota(user, cost);

    let llm: LlmCredentials;
    let userMessage: any;
    try {
      llm = await resolveLlmCredentials(user);
      userMessage = await plan.commit();
    } catch (err) {
      await settleQuota(reservation, false).catch(() => undefined);
      throw err;
    }

    await runTurn({
      req,
      res,
      controller: lease.controller,
      brain,
      chat: o.chat,
      userId: o.userId,
      user,
      mode: plan.mode,
      model,
      searchWeb: o.searchWeb,
      llm,
      reservation,
      userMessage,
      prompt: plan.prompt,
      newMessages: plan.newMessages,
      startedAt,
    });
  } finally {
    lease.release();
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/** POST /chats/:chatId/messages. Body: SendMessageBody (legacy `role: "user"` accepted). */
export const sendMessage = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const chatId = req.params.chatId;
  const body = req.body as SendMessageBody;
  const mode: ChatMode = body.mode ?? "chat";
  assertModeAllowed(mode);
  if (body.content.length > env.MAX_PROMPT_CHARS) {
    const message = `Messages are limited to ${env.MAX_PROMPT_CHARS} characters`;
    throw httpError(400, "VALIDATION_FAILED", message, { details: [{ path: "content", message }] });
  }
  const chat = await loadOwnedChat(chatId, userId);

  await startTurn(req, res, {
    chat,
    userId,
    model: body.model,
    searchWeb: body.searchWeb,
    plan: async () => ({
      prompt: body.content,
      mode,
      newMessages: 2,
      commit: () =>
        Message.create({
          chatId,
          userId,
          role: "user",
          content: body.content,
          status: "complete",
          mode,
          parentId: null,
        }),
    }),
  });
});

/** POST /chats/:chatId/messages/:messageId/regenerate. Only the latest assistant message. */
export const regenerateMessage = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { chatId, messageId } = req.params;
  const body = (req.body ?? {}) as RegenerateBody;
  const chat = await loadOwnedChat(chatId, userId);

  await startTurn(req, res, {
    chat,
    userId,
    model: body.model,
    searchWeb: body.searchWeb,
    plan: async () => {
      const target: any = await Message.findOne({ _id: messageId, chatId, role: "assistant" }).lean();
      if (!target) throw notFound("Message");
      const newer = await Message.exists({
        chatId,
        role: "assistant",
        _id: { $ne: target._id },
        $or: [{ createdAt: { $gt: target.createdAt } }, { createdAt: target.createdAt, _id: { $gt: target._id } }],
      });
      if (newer) throw httpError(409, "CONFLICT", "Only the latest answer can be regenerated.");

      let parent: any = target.parentId ? await Message.findOne({ _id: target.parentId, chatId, role: "user" }).lean() : null;
      if (!parent) {
        parent = await Message.findOne({ chatId, role: "user", createdAt: { $lte: target.createdAt } })
          .sort({ createdAt: -1, _id: -1 })
          .lean();
      }
      if (!parent) throw httpError(409, "CONFLICT", "There is no question to answer again.");

      return {
        prompt: parent.content,
        mode: body.mode ?? (target.mode === "research" ? "research" : "chat"),
        newMessages: 1,
        commit: async () => {
          const del = await Message.deleteOne({ _id: target._id, chatId });
          if (del.deletedCount > 0) {
            await Chat.updateOne({ _id: chatId, messageCount: { $gt: 0 } }, { $inc: { messageCount: -1 } });
          }
          return parent;
        },
      };
    },
  });
});

/** POST /chats/:chatId/stop -> 202 {stopped}. Only the chat owner can stop it. */
export const stopGeneration = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { chatId } = req.params;
  await loadOwnedChat(chatId, userId);
  res.status(202).json({ stopped: stopChat(chatId, userId) });
});
