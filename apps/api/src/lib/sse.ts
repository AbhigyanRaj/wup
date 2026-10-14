import type { Response } from "express";
import type { StreamEvent } from "@wup/contracts";

/**
 * Server-Sent Events helper for the chat stream.
 *
 * - Disables proxy buffering and transforms, flushes headers immediately.
 * - `send(ev)` writes one `data: <json>\n\n` frame.
 * - Writes a `: ping` comment every 15s so idle proxies keep the socket open.
 * - Client disconnects abort `controller`: we listen on `res` "close", NOT
 *   `req` "close" (on Node 18+ the request emits close as soon as its body has
 *   been read, which would abort every stream immediately).
 */

export const SSE_HEARTBEAT_MS = 15_000;

/** Loosely typed so brain events can be forwarded as-is. */
export type SseEvent = StreamEvent | { type: string; [key: string]: unknown };

export interface SseStream {
  /** Writes one event. Returns false when the connection is already gone. */
  send(ev: SseEvent): boolean;
  /** Ends the response (idempotent) and clears timers. */
  end(): void;
  /** true once the client went away or end() was called. */
  readonly closed: boolean;
  readonly signal: AbortSignal;
  readonly controller: AbortController;
}

export function openSse(
  res: Response,
  opts: { controller?: AbortController; heartbeatMs?: number } = {}
): SseStream {
  const controller = opts.controller ?? new AbortController();
  let closed = false;

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const writable = () => !closed && !res.writableEnded && !res.destroyed;

  const heartbeat = setInterval(() => {
    if (writable()) res.write(": ping\n\n");
  }, opts.heartbeatMs ?? SSE_HEARTBEAT_MS);
  heartbeat.unref?.();

  const cleanup = () => clearInterval(heartbeat);

  res.on("close", () => {
    closed = true;
    cleanup();
    // Closed before we finished writing: the client disconnected.
    if (!res.writableFinished && !controller.signal.aborted) controller.abort();
  });

  return {
    send(ev) {
      if (!writable()) return false;
      try {
        res.write(`data: ${JSON.stringify(ev)}\n\n`);
        return true;
      } catch {
        return false;
      }
    },
    end() {
      cleanup();
      if (!res.writableEnded) res.end();
      closed = true;
    },
    get closed() {
      return closed || res.destroyed;
    },
    signal: controller.signal,
    controller,
  };
}
