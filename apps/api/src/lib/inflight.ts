/**
 * In-flight generations, one per chat (per process).
 *
 * A second send to a chat that is still generating is rejected (409 CHAT_BUSY)
 * by the caller. POST /chats/:chatId/stop aborts the entry's controller.
 * Always release the lease in a `finally`.
 */

export interface InflightEntry {
  controller: AbortController;
  userId: string;
  startedAt: number;
}

export interface InflightLease {
  readonly controller: AbortController;
  readonly signal: AbortSignal;
  release(): void;
}

const inflight = new Map<string, InflightEntry>();

/** Claims the chat. Returns null when another generation is running. */
export function acquireChat(chatId: string, userId: string): InflightLease | null {
  const key = String(chatId);
  if (inflight.has(key)) return null;
  const entry: InflightEntry = { controller: new AbortController(), userId: String(userId), startedAt: Date.now() };
  inflight.set(key, entry);
  let released = false;
  return {
    controller: entry.controller,
    signal: entry.controller.signal,
    release() {
      if (released) return;
      released = true;
      // Only remove our own entry.
      if (inflight.get(key) === entry) inflight.delete(key);
    },
  };
}

/** Aborts the running generation when it belongs to `userId`. */
export function stopChat(chatId: string, userId: string): boolean {
  const entry = inflight.get(String(chatId));
  if (!entry || entry.userId !== String(userId)) return false;
  if (!entry.controller.signal.aborted) entry.controller.abort();
  return true;
}

export function isChatBusy(chatId: string): boolean {
  return inflight.has(String(chatId));
}

/** Test helper. */
export function inflightSize(): number {
  return inflight.size;
}
