/**
 * POST /chats/:chatId/messages (SSE), regenerate and stop, against
 * createApp({brain: fakeBrain}) and an in-memory MongoDB.
 */
import "./chat.env";
import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "http";
import type { AddressInfo } from "net";
import request from "supertest";
import { Chat, Message, User } from "@wup/models";
import { inflightSize } from "../src/lib/inflight";
import { createApp } from "../src/app";
import { encryptApiKey } from "../src/services/llmCredentials";
import {
  FakeBrain,
  baseResult,
  buildApp,
  clearDb,
  createChat,
  makeUser,
  parseSse,
  postSse,
  sleep,
  startDb,
  stopDb,
  streamingScript,
  waitFor,
} from "./chat.helpers";

const brain = new FakeBrain();
const app = buildApp(brain);

before(startDb);
after(stopDb);
beforeEach(async () => {
  await clearDb();
  brain.reset();
});

describe("send message stream", () => {
  test("emits start, then progress and tokens, then done", async () => {
    const { auth } = await makeUser();
    const chat = await createChat(app, auth, { title: "Order test" });
    brain.script = async (_req, { emit }) => {
      emit({ type: "status", message: "Looking things up", code: "context.rag" });
      emit({ type: "tool", id: "t1", name: "db_query", label: "Querying orders", state: "running" });
      emit({ type: "sources", sources: [{ n: 1, kind: "web", title: "Site", cited: false, url: "https://example.com", snippet: null }] });
      emit({ type: "tool", id: "t1", name: "db_query", label: "Querying orders", state: "done" });
      emit({ type: "token", text: "Hel" });
      emit({ type: "token", text: "lo" });
      // Events the brain must not be able to inject are dropped.
      emit({ type: "done", message: {} });
      return baseResult({ content: "Hello" });
    };

    const { res, events } = await postSse(app, `/chats/${chat.id}/messages`, auth, { content: "Hi there" });
    assert.equal(res.status, 200);
    assert.match(String(res.headers["content-type"]), /text\/event-stream/);
    assert.equal(res.headers["cache-control"], "no-cache, no-transform");
    assert.equal(res.headers["x-accel-buffering"], "no");

    const types = events.map((e) => e.type);
    assert.deepEqual(types, ["start", "status", "tool", "sources", "tool", "token", "token", "done"]);
    const start = events[0];
    assert.equal(start.chatId, chat.id);
    assert.equal(start.mode, "chat");
    assert.ok(start.requestId);
    const done = events.at(-1).message;
    assert.equal(done.userMessage.id, start.userMessageId);
    assert.equal(done.assistantMessage.id, start.assistantMessageId);
    assert.equal(done.assistantMessage.content, "Hello");
    assert.equal(done.assistantMessage.parentId, start.userMessageId);
    assert.equal(done.usage.tier, "free");
    assert.equal(done.usage.freeTierUsage, 1);
    assert.equal(inflightSize(), 0);

    const stored: any = await Chat.findById(chat.id).lean();
    assert.equal(stored.messageCount, 2);
  });

  test("persists followUps, clarification, model, metrics, sources and queries", async () => {
    const { auth } = await makeUser();
    const chat = await createChat(app, auth, { title: "Persist" });
    brain.script = streamingScript("Answer [1]", {
      followUps: [
        { label: "More", suggestedPrompt: "Tell me more" },
        { label: "Chart it", suggestedPrompt: "Show a chart" },
      ],
      clarification: { question: "Which year?", options: ["2024", "2025"], allowFreeText: true },
      model: { provider: "anthropic", id: "claude-x", usingOwnKey: true },
      usage: { tokensIn: 111, tokensOut: 22 },
      toolCalls: 3,
      firstTokenMs: 42,
      sources: [
        { n: 1, kind: "doc", title: "report.pdf", cited: true, sourceId: "65f1a2b3c4d5e6f7a8b9c0d1", page: 2, chunkIndex: 4, snippet: "x".repeat(1000), score: 0.9 },
        { n: 2, kind: "web", title: "Example", cited: false, url: "https://example.com", snippet: "web text" },
      ],
      queries: [{ tool: "mongo_find", connectionName: "Prod", db: "shop", collection: "orders", query: '{"a":1}', rowCount: 3, truncated: false, durationMs: 5 }],
      exhausted: ["gemini-2.5-flash"],
    });

    const { events } = await postSse(app, `/chats/${chat.id}/messages`, auth, { content: "Question" });
    const done = events.at(-1);
    assert.equal(done.type, "done");
    assert.equal(done.message.usedModel, "claude-x");
    assert.deepEqual(done.message.exhausted, ["gemini-2.5-flash"]);
    assert.equal(done.message.followUps.length, 2);
    assert.equal(done.message.clarification.question, "Which year?");

    const msg: any = await Message.findById(done.message.assistantMessage.id).lean();
    assert.equal(msg.status, "complete");
    assert.equal(msg.mode, "chat");
    assert.deepEqual(msg.followUps.map((f: any) => f.label), ["More", "Chart it"]);
    assert.deepEqual(msg.clarification.options, ["2024", "2025"]);
    assert.equal(msg.model.id, "claude-x");
    assert.equal(msg.model.provider, "anthropic");
    assert.equal(msg.model.usingOwnKey, true);
    assert.equal(msg.metrics.tokensIn, 111);
    assert.equal(msg.metrics.tokensOut, 22);
    assert.equal(msg.metrics.toolCalls, 3);
    assert.equal(msg.metrics.firstTokenMs, 42);
    assert.ok(msg.metrics.latencyMs >= 0);
    assert.equal(msg.sources.length, 2);
    assert.equal(msg.sources[0].snippet.length, 300, "source snippets are clipped");
    assert.equal(msg.queries[0].collection, "orders");
    // Legacy citation arrays derived from sources
    assert.equal(msg.ragSources[0].sourceFile, "report.pdf");
    assert.equal(msg.ragSources[0].pageNumber, 2);
    assert.equal(msg.webSources[0].url, "https://example.com");
  });

  test("a brain error emits an error event and persists an error message", async () => {
    const { auth, id } = await makeUser();
    const chat = await createChat(app, auth, { title: "Errors" });
    brain.script = async (_req, { emit }) => {
      emit({ type: "token", text: "Partial " });
      return {
        content: "Partial",
        outcome: "error",
        producedOutput: false,
        error: { code: "PROVIDER_ERROR", message: "The provider is down." },
      };
    };

    const { events } = await postSse(app, `/chats/${chat.id}/messages`, auth, { content: "Hi" });
    const last = events.at(-1);
    assert.equal(last.type, "error");
    assert.equal(last.code, "PROVIDER_ERROR");
    assert.equal(last.message, "The provider is down.");
    assert.equal(last.retryable, true);
    assert.equal(last.assistantMessage.status, "error");
    assert.ok(!events.some((e) => e.type === "done"));

    const msg: any = await Message.findById(last.assistantMessage.id).lean();
    assert.equal(msg.status, "error");
    assert.equal(msg.error.code, "PROVIDER_ERROR");
    assert.equal(msg.content, "Partial");
    // No output: the reserved message is refunded.
    const user: any = await User.findById(id).lean();
    assert.equal(user.freeTierUsage, 0);
  });

  test("a throwing brain is reported as INTERNAL without leaking the exception", async () => {
    const { auth } = await makeUser();
    const chat = await createChat(app, auth, { title: "Throws" });
    brain.script = async () => {
      throw new Error("secret connection string mongodb://user:pw@host");
    };
    const { events } = await postSse(app, `/chats/${chat.id}/messages`, auth, { content: "Hi" });
    const last = events.at(-1);
    assert.equal(last.type, "error");
    assert.equal(last.code, "INTERNAL");
    assert.doesNotMatch(last.message, /mongodb:\/\//);
    const msg: any = await Message.findById(last.assistantMessage.id).lean();
    assert.equal(msg.status, "error");
  });

  test('visualType "bar" is persisted as "none" and the answer is kept', async () => {
    const { auth } = await makeUser();
    const chat = await createChat(app, auth, { title: "Visuals" });
    brain.script = streamingScript("Here is a chart", {
      visualType: "bar",
      chartData: { type: "scatter", xAxisKey: "month", yAxisKey: "total", series: [{ month: "Jan", total: 3 }] },
    });
    const { events } = await postSse(app, `/chats/${chat.id}/messages`, auth, { content: "Chart" });
    const done = events.at(-1);
    assert.equal(done.type, "done");
    const msg: any = await Message.findById(done.message.assistantMessage.id).lean();
    assert.equal(msg.visualType, "none");
    assert.equal(msg.chartData.type, "bar", "unknown chart types fall back to bar");
    assert.equal(msg.content, "Here is a chart");
  });

  test("history excludes errored turns and flags a previous clarification", async () => {
    const { auth, id } = await makeUser();
    const chat = await createChat(app, auth, { title: "History" });
    const t0 = Date.now() - 10_000;
    const q1 = await Message.create({ chatId: chat.id, userId: id, role: "user", content: "first", createdAt: new Date(t0) });
    await Message.create({ chatId: chat.id, userId: id, role: "assistant", content: "boom", status: "error", parentId: q1._id, createdAt: new Date(t0 + 1) });
    await Message.create({
      chatId: chat.id,
      userId: id,
      role: "assistant",
      content: "Which one?",
      clarification: { question: "Which one?", options: ["A", "B"] },
      parentId: q1._id,
      createdAt: new Date(t0 + 2),
    });
    await postSse(app, `/chats/${chat.id}/messages`, auth, { content: "A" });
    const call = brain.calls[0];
    assert.deepEqual(call.history.map((h) => h.content), ["first", "Which one?"]);
    assert.equal(call.previousWasClarification, true);
    assert.equal(call.prompt, "A");
  });
});

describe("guards before the stream", () => {
  test("free-tier limit is a JSON 429 before any SSE", async () => {
    const { auth, id } = await makeUser({ freeTierUsage: 5, freeTierLimit: 5 });
    const chat = await createChat(app, auth, { title: "Quota" });
    const res = await request(app).post(`/chats/${chat.id}/messages`).set("Authorization", auth).send({ content: "Hi" });
    assert.equal(res.status, 429);
    assert.match(String(res.headers["content-type"]), /application\/json/);
    assert.equal(res.body.code, "FREE_LIMIT_REACHED");
    assert.ok(res.body.error);
    assert.equal(brain.calls.length, 0);
    assert.equal(await Message.countDocuments({ chatId: chat.id }), 0);
    const user: any = await User.findById(id).lean();
    assert.equal(user.freeTierUsage, 5);
  });

  test("content over 8000 chars is a 400", async () => {
    const { auth } = await makeUser();
    const chat = await createChat(app, auth, { title: "Long" });
    const res = await request(app).post(`/chats/${chat.id}/messages`).set("Authorization", auth).send({ content: "a".repeat(8001) });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "VALIDATION_FAILED");
    const ok = await postSse(app, `/chats/${chat.id}/messages`, auth, { content: "a".repeat(8000) });
    assert.equal(ok.res.status, 200);
  });

  test("research mode is rejected when research is disabled", async () => {
    const { auth } = await makeUser();
    const chat = await createChat(app, auth, { title: "Research" });
    const res = await request(app).post(`/chats/${chat.id}/messages`).set("Authorization", auth).send({ content: "Dig", mode: "research" });
    // test/chat.env.ts sets RESEARCH_ENABLED=false
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "VALIDATION_FAILED");
    assert.equal(brain.calls.length, 0);
  });

  test("another user's chat is a 404 and a malformed id is a 400", async () => {
    const owner = await makeUser();
    const other = await makeUser();
    const chat = await createChat(app, owner.auth, { title: "Mine" });
    const res = await request(app).post(`/chats/${chat.id}/messages`).set("Authorization", other.auth).send({ content: "Hi" });
    assert.equal(res.status, 404);
    const bad = await request(app).post(`/chats/not-an-id/messages`).set("Authorization", owner.auth).send({ content: "Hi" });
    assert.equal(bad.status, 400);
  });

  test("a concurrent send to the same chat gets 409 CHAT_BUSY", async () => {
    const { auth } = await makeUser();
    const chat = await createChat(app, auth, { title: "Busy" });
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    brain.script = async (_req, { emit }) => {
      emit({ type: "token", text: "working" });
      await gate;
      return baseResult({ content: "working" });
    };
    const first = postSse(app, `/chats/${chat.id}/messages`, auth, { content: "one" });
    await waitFor(async () => brain.calls.length === 1);

    const second = await request(app).post(`/chats/${chat.id}/messages`).set("Authorization", auth).send({ content: "two" });
    assert.equal(second.status, 409);
    assert.equal(second.body.code, "CHAT_BUSY");

    release();
    const { events } = await first;
    assert.equal(events.at(-1).type, "done");
    // Free again
    const third = await postSse(app, `/chats/${chat.id}/messages`, auth, { content: "three" });
    assert.equal(third.events.at(-1).type, "done");
  });
});

describe("abort and stop", () => {
  test("a client disconnect aborts the brain and persists a stopped message", async () => {
    const { auth } = await makeUser();
    const chat = await createChat(app, auth, { title: "Abort" });
    let sawAbort = false;
    brain.script = async (_req, { emit, signal }) => {
      emit({ type: "token", text: "partial " });
      emit({ type: "token", text: "answer" });
      await new Promise<void>((resolve) => {
        if (signal.aborted) return resolve();
        signal.addEventListener("abort", () => resolve(), { once: true });
        setTimeout(resolve, 5000);
      });
      sawAbort = signal.aborted;
      return { content: "", outcome: "stopped", producedOutput: true };
    };

    const server = http.createServer(app).listen(0);
    try {
      const port = (server.address() as AddressInfo).port;
      await new Promise<void>((resolve, reject) => {
        const req = http.request(
          {
            port,
            method: "POST",
            path: `/chats/${chat.id}/messages`,
            headers: { "Content-Type": "application/json", Authorization: auth },
          },
          (res) => {
            let buf = "";
            res.setEncoding("utf8");
            res.on("data", (c) => {
              buf += c;
              if (buf.includes('"type":"token"')) {
                req.destroy();
                resolve();
              }
            });
            res.on("error", () => undefined);
          }
        );
        req.on("error", () => undefined);
        req.on("close", () => resolve());
        setTimeout(() => reject(new Error("no token received")), 4000);
        req.end(JSON.stringify({ content: "Long question" }));
      });

      const msg: any = await waitFor(() => Message.findOne({ chatId: chat.id, role: "assistant" }).lean());
      assert.equal(sawAbort, true, "the brain saw signal.aborted");
      assert.equal(brain.signals[0].aborted, true);
      assert.equal(msg.status, "stopped");
      assert.equal(msg.content, "partial answer");
      await waitFor(async () => inflightSize() === 0);
    } finally {
      server.close();
    }
  });

  test("POST /stop aborts the running generation (owner only)", async () => {
    const owner = await makeUser();
    const other = await makeUser();
    const chat = await createChat(app, owner.auth, { title: "Stop" });
    brain.script = async (_req, { emit, signal }) => {
      emit({ type: "token", text: "half" });
      await new Promise<void>((resolve) => {
        signal.addEventListener("abort", () => resolve(), { once: true });
        setTimeout(resolve, 5000);
      });
      return { content: "half", outcome: "stopped", producedOutput: true };
    };
    const streaming = postSse(app, `/chats/${chat.id}/messages`, owner.auth, { content: "go" });
    await waitFor(async () => brain.calls.length === 1);

    const foreign = await request(app).post(`/chats/${chat.id}/stop`).set("Authorization", other.auth);
    assert.equal(foreign.status, 404);
    assert.equal(brain.signals[0].aborted, false);

    const stop = await request(app).post(`/chats/${chat.id}/stop`).set("Authorization", owner.auth);
    assert.equal(stop.status, 202);
    assert.deepEqual(stop.body, { stopped: true });

    const { events } = await streaming;
    assert.ok(!events.some((e) => e.type === "error"), "a stop is not an error");
    const last = events.at(-1);
    assert.equal(last.type, "done");
    assert.equal(last.message.assistantMessage.status, "stopped");
    assert.equal(last.message.assistantMessage.content, "half");
    assert.equal(last.message.userMessage.content, "go");
    assert.deepEqual(last.message.followUps, []);
    assert.equal(last.message.clarification, null);
    const stored: any = await Message.findById(last.message.assistantMessage.id).lean();
    assert.equal(stored.status, "stopped");
    assert.equal(stored.content, "half");

    const idle = await request(app).post(`/chats/${chat.id}/stop`).set("Authorization", owner.auth);
    assert.deepEqual(idle.body, { stopped: false });
  });
});

describe("titles", () => {
  test("an untitled chat gets a generated title event, persisted as auto", async () => {
    const { auth } = await makeUser();
    const chat = await createChat(app, auth);
    assert.equal(chat.title, "New chat");
    assert.equal(chat.titleSource, "auto");
    brain.title = "Quarterly revenue";

    const { events } = await postSse(app, `/chats/${chat.id}/messages`, auth, { content: "What was revenue last quarter?" });
    const types = events.map((e) => e.type);
    assert.deepEqual(types.slice(-2), ["title", "done"]);
    const titleEv = events.find((e) => e.type === "title");
    assert.equal(titleEv.title, "Quarterly revenue");
    assert.equal(titleEv.chatId, chat.id);

    const stored: any = await Chat.findById(chat.id).lean();
    assert.equal(stored.title, "Quarterly revenue");
    assert.equal(stored.titleSource, "auto");

    // Second message: no new title
    const again = await postSse(app, `/chats/${chat.id}/messages`, auth, { content: "And before?" });
    assert.ok(!again.events.some((e) => e.type === "title"));
  });

  test("a failed generateTitle falls back to the heuristic title", async () => {
    const { auth } = await makeUser();
    const chat = await createChat(app, auth);
    brain.title = null;
    const { events } = await postSse(app, `/chats/${chat.id}/messages`, auth, { content: "Show me the top customers" });
    const titleEv = events.find((e) => e.type === "title");
    assert.equal(titleEv.title, "Show me the top customers");
  });

  test("a user-titled chat is never renamed", async () => {
    const { auth } = await makeUser();
    const chat = await createChat(app, auth, { title: "My title" });
    const { events } = await postSse(app, `/chats/${chat.id}/messages`, auth, { content: "Hello" });
    assert.ok(!events.some((e) => e.type === "title"));
    const stored: any = await Chat.findById(chat.id).lean();
    assert.equal(stored.title, "My title");
  });
});

describe("regenerate", () => {
  test("replaces the latest assistant message", async () => {
    const { auth } = await makeUser();
    const chat = await createChat(app, auth, { title: "Regen" });
    brain.script = streamingScript("first answer");
    const firstRun = await postSse(app, `/chats/${chat.id}/messages`, auth, { content: "Question?" });
    const firstDone = firstRun.events.at(-1).message;

    brain.script = streamingScript("second answer");
    const { res, events } = await postSse(
      app,
      `/chats/${chat.id}/messages/${firstDone.assistantMessage.id}/regenerate`,
      auth,
      {}
    );
    assert.equal(res.status, 200);
    assert.equal(events[0].type, "start");
    assert.equal(events[0].userMessageId, firstDone.userMessage.id);
    const done = events.at(-1);
    assert.equal(done.type, "done");
    assert.equal(done.message.assistantMessage.content, "second answer");
    assert.equal(done.message.assistantMessage.parentId, firstDone.userMessage.id);
    assert.equal(brain.calls[1].prompt, "Question?");
    assert.equal(brain.calls[1].history.length, 0, "the replaced answer is not in the history");

    assert.equal(await Message.exists({ _id: firstDone.assistantMessage.id }), null);
    const all: any[] = await Message.find({ chatId: chat.id }).sort({ createdAt: 1 }).lean();
    assert.deepEqual(all.map((m) => m.content), ["Question?", "second answer"]);
    const stored: any = await Chat.findById(chat.id).lean();
    assert.equal(stored.messageCount, 2);
  });

  test("only the latest assistant message can be regenerated", async () => {
    const { auth } = await makeUser();
    const chat = await createChat(app, auth, { title: "Regen old" });
    const a = await postSse(app, `/chats/${chat.id}/messages`, auth, { content: "one" });
    await postSse(app, `/chats/${chat.id}/messages`, auth, { content: "two" });
    const res = await request(app)
      .post(`/chats/${chat.id}/messages/${a.events.at(-1).message.assistantMessage.id}/regenerate`)
      .set("Authorization", auth)
      .send({});
    assert.equal(res.status, 409);
    assert.equal(res.body.code, "CONFLICT");
  });
});

describe("legacy client flow", () => {
  test("create {title}, stream {role, content, model, searchWeb}, parse the done payload", async () => {
    const { auth } = await makeUser();
    // 1. Create, exactly as the old dashboard does
    const created = await request(app).post("/chats").set("Authorization", auth).send({ title: "How many orders sh…" });
    assert.equal(created.status, 201);
    assert.ok(created.body._id);
    assert.equal(created.body.titleSource, "user");

    // 2. PATCH bridgeIds (unknown ids are dropped, not an error)
    const patched = await request(app)
      .patch(`/chats/${created.body._id}`)
      .set("Authorization", auth)
      .send({ bridgeIds: ["65f1a2b3c4d5e6f7a8b9c0d1"] });
    assert.equal(patched.status, 200);
    assert.deepEqual(patched.body.bridgeIds, []);

    brain.script = streamingScript("There were 42 orders.", {
      sources: [{ n: 1, kind: "doc", title: "orders.pdf", cited: true, sourceId: "65f1a2b3c4d5e6f7a8b9c0d1", page: 1, chunkIndex: 0, snippet: "42 orders", score: 0.8 }],
      followUps: [{ label: "By month", suggestedPrompt: "Break it down by month" }],
    });

    // 3. Stream with the legacy body, parse like the old client (split on blank lines)
    const res = await request(app)
      .post(`/chats/${created.body._id}/messages`)
      .set("Authorization", auth)
      .send({ role: "user", content: "How many orders shipped?", model: "Auto-Rotate", searchWeb: false })
      .buffer(true)
      .parse((r: any, cb: any) => {
        let d = "";
        r.setEncoding("utf8");
        r.on("data", (c: string) => (d += c));
        r.on("end", () => cb(null, d));
      });
    assert.equal(res.status, 200);

    let finalData: any = null;
    let text = "";
    const statuses: string[] = [];
    for (const part of String(res.body).split("\n\n")) {
      if (!part.startsWith("data: ")) continue;
      const data = JSON.parse(part.slice(6));
      if (data.type === "status") statuses.push(data.message);
      else if (data.type === "token") text += data.text;
      else if (data.type === "done") finalData = data.message;
    }
    assert.equal(text, "There were 42 orders.");
    assert.ok(statuses.length > 0);
    assert.ok(finalData);
    assert.ok(finalData.userMessage._id);
    assert.equal(finalData.userMessage.content, "How many orders shipped?");
    assert.equal(finalData.assistantMessage.content, "There were 42 orders.");
    assert.ok(Array.isArray(finalData.assistantMessage.ragSources));
    assert.equal(finalData.assistantMessage.ragSources[0].sourceFile, "orders.pdf");
    assert.ok(Array.isArray(finalData.assistantMessage.webSources));
    assert.equal(finalData.assistantMessage.visualType, "none");
    assert.ok(Array.isArray(finalData.assistantMessage.queries));
    assert.equal(finalData.followUps[0].label, "By month");
    assert.equal(finalData.clarification, null);
    assert.equal(typeof finalData.usedModel, "string");
    assert.ok(Array.isArray(finalData.exhausted));
    // "Auto-Rotate" is automatic routing: the brain gets no explicit model.
    assert.equal(brain.calls[0].model, undefined);

    // 4. Reload, as the old client does when switching chats
    const list = await request(app).get("/chats").set("Authorization", auth);
    assert.ok(Array.isArray(list.body));
    assert.equal(list.body[0]._id, created.body._id);
    const msgs = await request(app).get(`/chats/${created.body._id}/messages`).set("Authorization", auth);
    assert.ok(Array.isArray(msgs.body));
    assert.deepEqual(msgs.body.map((m: any) => m.role), ["user", "assistant"]);
    assert.equal(msgs.body[1].ragSources[0].sourceFile, "orders.pdf");

    // 5. Delete
    const del = await request(app).delete(`/chats/${created.body._id}`).set("Authorization", auth);
    assert.equal(del.status, 200);
    assert.equal(await Message.countDocuments({ chatId: created.body._id }), 0);
  });

  test("parseSse helper reads frames", () => {
    assert.deepEqual(parseSse('data: {"type":"a"}\n\n: ping\n\ndata: {"type":"b"}\n\n').map((e) => e.type), ["a", "b"]);
  });
});

describe("credentials and quota", () => {
  test("a BYOK user gets decrypted credentials and is never charged", async () => {
    const { enc, hint } = encryptApiKey("sk-test-0123456789abcdef");
    const { auth, id } = await makeUser({ customApiKeyEnc: enc, customApiKeyHint: hint, customApiProvider: "anthropic", freeTierUsage: 50, freeTierLimit: 50 });
    const chat = await createChat(app, auth, { title: "BYOK" });
    const { events } = await postSse(app, `/chats/${chat.id}/messages`, auth, { content: "Hi", model: "claude-sonnet-4-5" });
    const done = events.at(-1);
    assert.equal(done.type, "done");
    assert.equal(done.message.usage.tier, "byok");
    const llm = brain.calls[0].llm;
    assert.equal(llm.provider, "anthropic");
    assert.equal(llm.apiKey, "sk-test-0123456789abcdef");
    assert.ok(llm.keyId && !llm.keyId.includes("sk-test"));
    assert.equal(brain.calls[0].model, "claude-sonnet-4-5");
    const user: any = await User.findById(id).lean();
    assert.equal(user.freeTierUsage, 50);
  });

  test("a free user is charged exactly once per send and uses the server key", async () => {
    const { auth, id } = await makeUser({ freeTierUsage: 0, freeTierLimit: 3 });
    const chat = await createChat(app, auth, { title: "Free" });
    await postSse(app, `/chats/${chat.id}/messages`, auth, { content: "one" });
    await postSse(app, `/chats/${chat.id}/messages`, auth, { content: "two" });
    assert.equal(brain.calls[0].llm.apiKey, null);
    const user: any = await User.findById(id).lean();
    assert.equal(user.freeTierUsage, 2);
  });

  test("a brain without run() is a JSON 503 before any charge; askStream is never used", async () => {
    let askCalled = false;
    const oldBrain = {
      async *askStream() {
        askCalled = true;
        yield "should not run";
      },
    };
    const oldApp = createApp({ brain: oldBrain });
    const { auth, id } = await makeUser();
    const chat = await createChat(oldApp, auth, { title: "Old brain" });
    const res = await request(oldApp).post(`/chats/${chat.id}/messages`).set("Authorization", auth).send({ content: "Hi" });
    assert.equal(res.status, 503);
    assert.equal(res.body.code, "MODEL_UNAVAILABLE");
    assert.equal(askCalled, false);
    assert.equal(await Message.countDocuments({ chatId: chat.id }), 0);
    const user: any = await User.findById(id).lean();
    assert.equal(user.freeTierUsage, 0);
    assert.equal(inflightSize(), 0);
  });
});

// Keep a reference so the import is not flagged as unused when tests are filtered.
void sleep;
