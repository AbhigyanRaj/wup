/**
 * Server-Sent Events helpers for supertest.
 *
 *   const res = await sse(agent.post(`/chats/${id}/messages`).send({ content: "hi" }));
 *   res.events  // [{ event: "message", data: { type: "token", text: "Hello " } }, ...]
 *   res.types   // ["status", "token", "token", "done"]
 *
 * parseSse(text) parses a raw stream: blocks separated by a blank line, with
 * `event:`, `data:` (multi-line joined by \n), `id:` and comment lines. `data`
 * is JSON-parsed when possible.
 */
import type { Response, Test } from "supertest";

export interface SseEvent {
  event: string;
  data: any;
  id?: string;
  raw: string;
}

export function parseSse(text: string): SseEvent[] {
  const events: SseEvent[] = [];
  for (const block of text.replace(/\r\n/g, "\n").split(/\n\n+/)) {
    if (!block.trim()) continue;
    let event = "message";
    let id: string | undefined;
    const data: string[] = [];
    for (const line of block.split("\n")) {
      if (!line || line.startsWith(":")) continue;
      const idx = line.indexOf(":");
      const field = idx === -1 ? line : line.slice(0, idx);
      let value = idx === -1 ? "" : line.slice(idx + 1);
      if (value.startsWith(" ")) value = value.slice(1);
      if (field === "event") event = value;
      else if (field === "data") data.push(value);
      else if (field === "id") id = value;
    }
    if (data.length === 0) continue;
    const raw = data.join("\n");
    let parsed: any = raw;
    try {
      parsed = JSON.parse(raw);
    } catch {
      /* keep raw string */
    }
    events.push({ event, data: parsed, id, raw });
  }
  return events;
}

/** Buffers a streamed response as text so it can be parsed after it ends. */
export function bufferText(req: Test): Test {
  return req.buffer(true).parse((res, cb) => {
    let s = "";
    res.setEncoding("utf8");
    res.on("data", (c: string) => (s += c));
    res.on("end", () => cb(null, s));
    res.on("error", (e: Error) => cb(e, s));
  });
}

export interface SseResponse {
  res: Response;
  status: number;
  text: string;
  events: SseEvent[];
  /** `data.type` of each event (or the SSE event name when data has no type). */
  types: string[];
}

export async function sse(req: Test): Promise<SseResponse> {
  const res = await bufferText(req);
  const text = typeof res.body === "string" ? res.body : res.text ?? "";
  const events = parseSse(text);
  return {
    res,
    status: res.status,
    text,
    events,
    types: events.map((e) => (e.data && typeof e.data === "object" && "type" in e.data ? String(e.data.type) : e.event)),
  };
}
