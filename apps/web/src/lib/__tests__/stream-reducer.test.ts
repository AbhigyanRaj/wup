import { describe, expect, it } from "vitest";
import { createEntry, isActivePhase, streamReducer, type StreamEntry } from "@/lib/stream-store";
import type { DonePayload, MessageDTO } from "@/lib/types";

const msg = (over: Partial<MessageDTO>): MessageDTO => ({
  id: "m",
  _id: "m",
  chatId: "c1",
  parentId: null,
  role: "assistant",
  content: "",
  status: "complete",
  mode: "chat",
  createdAt: new Date(0).toISOString(),
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
  ...over,
});

const base = (): StreamEntry => createEntry("c1", { content: "How many orders?", now: 1000 });

describe("streamReducer", () => {
  it("creates an optimistic user turn in the connecting phase", () => {
    const e = base();
    expect(e.phase).toBe("connecting");
    expect(e.userMessage?.content).toBe("How many orders?");
    expect(e.userMessage?.chatId).toBe("c1");
    expect(e.userKey).toMatch(/^u-/);
    expect(e.draft.clientKey).toMatch(/^a-/);
    expect(isActivePhase(e.phase)).toBe(true);
  });

  it("moves connecting -> thinking -> streaming and appends tokens", () => {
    let e = streamReducer(base(), { type: "META", userMessageId: "u1", assistantMessageId: "a1", mode: "chat" });
    expect(e.phase).toBe("thinking");
    expect(e.assistantMessageId).toBe("a1");
    e = streamReducer(e, { type: "STATUS", message: "Reading your data", at: 1100 });
    expect(e.draft.statuses.map((s) => s.message)).toEqual(["Reading your data"]);
    e = streamReducer(e, { type: "APPEND", text: "There are ", at: 1200 });
    e = streamReducer(e, { type: "APPEND", text: "42.", at: 1300 });
    expect(e.phase).toBe("streaming");
    expect(e.draft.content).toBe("There are 42.");
    expect(e.draft.firstTokenAt).toBe(1200);
  });

  it("upserts tools and records finished queries once", () => {
    let e = base();
    e = streamReducer(e, { type: "TOOL", tool: { id: "t1", name: "mongo_find", label: "orders", state: "running" }, at: 1 });
    e = streamReducer(e, { type: "TOOL", tool: { id: "t1", name: "mongo_find", label: "orders", state: "done", query: "{}" }, at: 2 });
    e = streamReducer(e, { type: "TOOL", tool: { id: "t1", name: "mongo_find", label: "orders", state: "done", query: "{}" }, at: 3 });
    expect(e.draft.tools).toHaveLength(1);
    expect(e.draft.tools[0].state).toBe("done");
    expect(e.draft.queries).toEqual(["{}"]);
  });

  it("upserts research steps by id and sorts sources", () => {
    let e = base();
    const step = { id: "s1", title: "Plan", status: "running" as const, detail: null, sourceNs: [], startedAt: null, finishedAt: null };
    e = streamReducer(e, { type: "STEP", step });
    e = streamReducer(e, { type: "STEP", step: { ...step, status: "done" } });
    expect(e.draft.steps).toEqual([{ ...step, status: "done" }]);
    e = streamReducer(e, {
      type: "SOURCES",
      sources: [
        { n: 2, kind: "web", title: "b", cited: true, url: "https://b.example", snippet: null },
        { n: 1, kind: "web", title: "a", cited: true, url: "https://a.example", snippet: null },
      ],
    });
    expect(e.draft.sources.map((s) => s.n)).toEqual([1, 2]);
  });

  it("finishes on DONE and ignores later tokens", () => {
    const payload: DonePayload = {
      userMessage: msg({ id: "u1", role: "user", content: "How many orders?" }),
      assistantMessage: msg({ id: "a1", content: "42", parentId: "u1" }),
      followUps: [],
      clarification: null,
      usedModel: null,
      exhausted: [],
      usage: { tier: "free", freeTierUsage: 1, freeTierLimit: 50 },
    };
    const e = streamReducer(base(), { type: "DONE", payload, at: 5000 });
    expect(e.phase).toBe("done");
    expect(e.final?.assistantMessage?.id).toBe("a1");
    expect(e.endedAt).toBe(5000);
    const after = streamReducer(e, { type: "APPEND", text: "late", at: 6000 });
    expect(after).toBe(e);
  });

  it("surfaces errors with the saved partial answer", () => {
    const e = streamReducer(base(), {
      type: "ERROR",
      error: { code: "PROVIDER_ERROR", message: "The model failed", retryable: true },
      assistantMessage: msg({ id: "a9", status: "error" }),
      at: 10,
    });
    expect(e.phase).toBe("error");
    expect(e.error?.message).toBe("The model failed");
    expect(e.final?.assistantMessage?.id).toBe("a9");
  });

  it("maps ABORTED errors and local aborts to the aborted phase", () => {
    expect(streamReducer(base(), { type: "ABORT", at: 1 }).phase).toBe("aborted");
    const e = streamReducer(base(), { type: "ERROR", error: { code: "ABORTED", message: "Stopped", retryable: false }, at: 1 });
    expect(e.phase).toBe("aborted");
    expect(e.error).toBeUndefined();
  });

  it("regenerate entries have no optimistic user message", () => {
    const e = createEntry("c1", { content: "", replacesMessageId: "a1" });
    expect(e.userMessage).toBeNull();
    expect(e.replacesMessageId).toBe("a1");
  });
});
