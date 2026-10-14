import { describe, expect, it, vi } from "vitest";
import { createSSEParser, frameToEvent, readSSE, StreamClosedError } from "@/lib/sse";

function responseFrom(chunks: string[]): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
}

describe("createSSEParser", () => {
  it("splits frames on blank lines across chunk boundaries", () => {
    const p = createSSEParser();
    expect(p.push('data: {"type":"tok')).toEqual([]);
    const frames = p.push('en","text":"hi"}\n\ndata: {"type":"token","text":"!"}\n\n');
    expect(frames.map((f) => f.data)).toEqual(['{"type":"token","text":"hi"}', '{"type":"token","text":"!"}']);
  });

  it("joins multi-line data fields and ignores comments", () => {
    const p = createSSEParser();
    const frames = p.push(': ping\n\ndata: {"type":"token",\ndata: "text":"a"}\n\n');
    expect(frames).toHaveLength(1);
    expect(frames[0].data).toBe('{"type":"token",\n"text":"a"}');
    expect(frameToEvent(frames[0])).toEqual({ type: "token", text: "a" });
  });

  it("normalises CRLF and flushes a trailing frame on end", () => {
    const p = createSSEParser();
    expect(p.push('data: {"type":"status","message":"x"}\r\n\r\ndata: {"type":"token","text":"y"}')).toHaveLength(1);
    expect(p.end().map((f) => f.data)).toEqual(['{"type":"token","text":"y"}']);
  });

  it("skips malformed and unknown frames", () => {
    expect(frameToEvent({ event: null, data: "{not json" })).toBeNull();
    expect(frameToEvent({ event: null, data: '{"type":"mystery"}' })).toBeNull();
    expect(frameToEvent({ event: "token", data: '{"text":"a"}' })).toEqual({ type: "token", text: "a" });
  });
});

describe("readSSE", () => {
  it("delivers error events to the handler (not swallowed)", async () => {
    const onEvent = vi.fn();
    await readSSE(
      responseFrom(['data: {"type":"token","text":"a"}\n\n', 'data: {"type":"error","code":"INTERNAL","message":"boom","retryable":true}\n\n']),
      onEvent,
    );
    expect(onEvent.mock.calls.map((c) => c[0].type)).toEqual(["token", "error"]);
  });

  it("lets handler exceptions propagate even after a malformed frame", async () => {
    const res = responseFrom(["data: {oops\n\n", 'data: {"type":"error","code":"INTERNAL","message":"boom","retryable":false}\n\n']);
    await expect(
      readSSE(res, (e) => {
        if (e.type === "error") throw new Error(e.message);
      }),
    ).rejects.toThrow("boom");
  });

  it("treats a stream without done as a lost connection", async () => {
    const res = responseFrom(['data: {"type":"token","text":"partial"}\n\n']);
    await expect(readSSE(res, () => {})).rejects.toBeInstanceOf(StreamClosedError);
    await expect(readSSE(responseFrom(['data: {"type":"token","text":"x"}\n\n']), () => {})).rejects.toThrow("Connection lost");
  });

  it("resolves after done", async () => {
    const events: string[] = [];
    await readSSE(responseFrom(['data: {"type":"done","message":{}}\n\n']), (e) => events.push(e.type));
    expect(events).toEqual(["done"]);
  });

  it("rejects with AbortError when aborted", async () => {
    const ctrl = new AbortController();
    const stream = new ReadableStream<Uint8Array>({ start() {} });
    const p = readSSE(new Response(stream), () => {}, ctrl.signal);
    ctrl.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
  });
});
