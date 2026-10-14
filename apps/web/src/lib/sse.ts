import type { StreamEvent } from "@/lib/types";

/*
 * Server-sent events reader for the chat stream.
 *
 * - Frames are separated by a blank line; `\r\n` is normalised first.
 * - Multi-line `data:` fields are joined with "\n" (per the SSE spec).
 * - Lines starting with ":" are comments (the server's `: ping` keep-alives).
 * - JSON.parse sits in a narrow try that only skips malformed frames. The
 *   callback runs OUTSIDE that try, so an `error` event (or a throw inside the
 *   handler) is never swallowed.
 * - A stream that ends without a `done` or `error` event is itself an error.
 */

export const STREAM_EVENT_TYPES = [
  "start",
  "status",
  "token",
  "tool",
  "sources",
  "step",
  "title",
  "done",
  "error",
] as const;

const KNOWN = new Set<string>(STREAM_EVENT_TYPES);

/** Raised when the connection drops before the server finished the turn. */
export class StreamClosedError extends Error {
  readonly code = "CONNECTION_LOST" as const;
  constructor(message = "Connection lost") {
    super(message);
    this.name = "StreamClosedError";
  }
}

export interface SSEFrame {
  /** The `event:` field, when present. */
  event: string | null;
  /** All `data:` lines joined with "\n". */
  data: string;
}

/**
 * Incremental frame parser. Feed decoded text with `push`; complete frames are
 * returned. `end()` flushes a trailing frame that had no closing blank line.
 */
export function createSSEParser() {
  let buffer = "";

  function parseFrame(raw: string): SSEFrame | null {
    let event: string | null = null;
    const data: string[] = [];
    for (const line of raw.split("\n")) {
      if (line === "" || line.startsWith(":")) continue;
      const colon = line.indexOf(":");
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? "" : line.slice(colon + 1);
      if (value.startsWith(" ")) value = value.slice(1);
      if (field === "data") data.push(value);
      else if (field === "event") event = value;
    }
    if (data.length === 0) return null;
    return { event, data: data.join("\n") };
  }

  function drain(final: boolean): SSEFrame[] {
    const frames: SSEFrame[] = [];
    let idx = buffer.indexOf("\n\n");
    while (idx !== -1) {
      const frame = parseFrame(buffer.slice(0, idx));
      if (frame) frames.push(frame);
      buffer = buffer.slice(idx + 2);
      idx = buffer.indexOf("\n\n");
    }
    if (final && buffer.trim() !== "") {
      const frame = parseFrame(buffer);
      if (frame) frames.push(frame);
      buffer = "";
    }
    return frames;
  }

  return {
    push(text: string): SSEFrame[] {
      buffer += text.replace(/\r\n?/g, "\n");
      return drain(false);
    },
    end(): SSEFrame[] {
      return drain(true);
    },
  };
}

/** Parses one frame into a known stream event, or null (malformed or unknown). */
export function frameToEvent(frame: SSEFrame): StreamEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(frame.data);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as { type?: unknown };
  // Some servers name the event in the `event:` field instead of the payload.
  if (typeof obj.type !== "string" && frame.event) (obj as { type?: unknown }).type = frame.event;
  if (typeof obj.type !== "string" || !KNOWN.has(obj.type)) return null;
  return obj as StreamEvent;
}

function abortError(): Error {
  try {
    return new DOMException("The stream was aborted", "AbortError");
  } catch {
    const err = new Error("The stream was aborted");
    err.name = "AbortError";
    return err;
  }
}

export function isAbortError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { name?: string }).name === "AbortError";
}

/**
 * Reads an SSE response to the end, calling `onEvent` for every known event.
 * Resolves after a `done` or `error` event and the end of the body.
 * Rejects with StreamClosedError when the body ends without one, and with an
 * AbortError when `signal` aborts.
 */
export async function readSSE(
  response: Response,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!response.body) throw new StreamClosedError("The server sent an empty response");
  if (signal?.aborted) throw abortError();

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  const parser = createSSEParser();
  let finished = false;

  const onAbort = () => {
    reader.cancel().catch(() => {});
  };
  signal?.addEventListener("abort", onAbort, { once: true });

  const dispatch = (frames: SSEFrame[]) => {
    for (const frame of frames) {
      const event = frameToEvent(frame);
      if (!event) continue;
      if (event.type === "done" || event.type === "error") finished = true;
      // Deliberately outside any try: handler errors propagate to the caller.
      onEvent(event);
    }
  };

  try {
    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (err) {
        if (signal?.aborted) throw abortError();
        if (finished) return;
        throw new StreamClosedError(err instanceof Error && err.message ? "Connection lost" : undefined);
      }
      if (signal?.aborted) throw abortError();
      if (chunk.done) break;
      dispatch(parser.push(decoder.decode(chunk.value, { stream: true })));
    }
    dispatch(parser.push(decoder.decode()));
    dispatch(parser.end());
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }

  if (signal?.aborted) throw abortError();
  if (!finished) throw new StreamClosedError();
}
