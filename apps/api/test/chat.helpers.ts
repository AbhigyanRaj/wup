/**
 * Shared setup for the chat tests: in-memory MongoDB, createApp({brain}) with
 * a scriptable fake brain, a signed-in user, and an SSE parser.
 */
import "./chat.env";
import type { Express } from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { Chat, Message, User, UsageDaily } from "@wup/models";
import { createApp } from "../src/app";
import { signToken } from "../src/lib/session";
import { resetRateLimits } from "../src/middleware/rateLimits";
import type { BrainEmitEvent, BrainRequest, BrainResult } from "../src/controllers/chat/deps";

let server: MongoMemoryServer | null = null;

export async function startDb(): Promise<void> {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri(), { dbName: "wuup_chat_test" });
  await Promise.all([User.init(), Chat.init(), Message.init(), UsageDaily.init()]);
}

export async function stopDb(): Promise<void> {
  await mongoose.disconnect();
  await server?.stop();
  server = null;
}

export async function clearDb(): Promise<void> {
  const db = mongoose.connection.db!;
  for (const c of await db.collections()) await c.deleteMany({});
  resetRateLimits();
}

// ─── Fake brain ───────────────────────────────────────────────────────────────

export type BrainCtx = { emit: (ev: BrainEmitEvent) => void; signal: AbortSignal };
export type BrainScript = (req: BrainRequest, ctx: BrainCtx) => Promise<Partial<BrainResult>> | Partial<BrainResult>;

export const baseResult = (over: Partial<BrainResult> = {}): BrainResult => ({
  content: "Hello there",
  followUps: [],
  clarification: null,
  visualType: "none",
  chartData: null,
  tableData: null,
  diagramData: null,
  sources: [],
  queries: [],
  research: null,
  model: { provider: "gemini", id: "gemini-2.5-flash", usingOwnKey: false },
  usage: { tokensIn: 10, tokensOut: 5 },
  toolCalls: 0,
  firstTokenMs: 12,
  exhausted: [],
  producedOutput: true,
  outcome: "complete",
  ...over,
});

/** Streams `content` as tokens, then returns a complete result. */
export const streamingScript =
  (content = "Hello there", over: Partial<BrainResult> = {}): BrainScript =>
  async (_req, { emit }) => {
    emit({ type: "status", message: "Thinking", code: "llm.generating" });
    for (const part of content.match(/.{1,5}/gs) ?? []) emit({ type: "token", text: part });
    return baseResult({ content, ...over });
  };

export class FakeBrain {
  script: BrainScript = streamingScript();
  title: string | null = "Generated title";
  titleDelayMs = 0;
  calls: BrainRequest[] = [];
  signals: AbortSignal[] = [];

  reset() {
    this.script = streamingScript();
    this.title = "Generated title";
    this.titleDelayMs = 0;
    this.calls = [];
    this.signals = [];
  }

  async run(req: BrainRequest, ctx: BrainCtx): Promise<BrainResult> {
    this.calls.push(req);
    this.signals.push(ctx.signal);
    return baseResult(await this.script(req, ctx));
  }

  async generateTitle(_prompt: string): Promise<string> {
    if (this.titleDelayMs) await new Promise((r) => setTimeout(r, this.titleDelayMs));
    if (!this.title) throw new Error("no title");
    return this.title;
  }

  heuristicTitle(prompt: string): string {
    return prompt.slice(0, 30);
  }
}

export function buildApp(brain: FakeBrain): Express {
  return createApp({ brain });
}

// ─── Users ────────────────────────────────────────────────────────────────────

let userSeq = 0;
export async function makeUser(over: Record<string, unknown> = {}) {
  userSeq += 1;
  const user: any = await User.create({ email: `chat-user-${userSeq}-${Date.now()}@example.com`, password: "x", ...over });
  const token = signToken(user);
  return { user, id: String(user._id), auth: `Bearer ${token}` };
}

// ─── SSE ──────────────────────────────────────────────────────────────────────

export function parseSse(text: string): any[] {
  const events: any[] = [];
  for (const frame of text.split("\n\n")) {
    for (const line of frame.split("\n")) {
      if (line.startsWith("data: ")) {
        try {
          events.push(JSON.parse(line.slice(6)));
        } catch {
          /* ignore */
        }
      }
    }
  }
  return events;
}

/** supertest parser that buffers an event stream as text. */
export function sseText(res: any, cb: (err: Error | null, body: string) => void) {
  let data = "";
  res.setEncoding("utf8");
  res.on("data", (c: string) => (data += c));
  res.on("end", () => cb(null, data));
}

export async function postSse(app: Express, path: string, auth: string, body: unknown) {
  const res = await request(app).post(path).set("Authorization", auth).send(body as object).buffer(true).parse(sseText);
  return { res, events: res.status === 200 ? parseSse(res.body as string) : [] };
}

export async function createChat(app: Express, auth: string, body: Record<string, unknown> = {}) {
  const res = await request(app).post("/chats").set("Authorization", auth).send(body);
  if (res.status !== 201) throw new Error(`create chat failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as { id: string; _id: string; title: string; titleSource: string };
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function waitFor<T>(fn: () => Promise<T | null | undefined | false>, timeoutMs = 3000): Promise<T> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v as T;
    if (Date.now() > until) throw new Error("waitFor timed out");
    await sleep(20);
  }
}
