/*
 * Extra chat streaming scenarios for e2e/chat.spec.ts.
 *
 * The shared mock (server.mjs) answers quickly and ignores /stop. These tests
 * need a slow stream that honours stop, and exact answer text (a fence that
 * contains "[1]"). The spec starts this server in-process and re-routes the
 * browser's POST /chats/:id/messages (and /stop) here with page.route, so the
 * shared mock stays untouched.
 *
 *   const s = await startChatScenarios();   // { url, close }
 *   POST {url}/stream/slow?chatId=..   tokens every 80ms for ~10s, stops on /stop
 *   POST {url}/stream/fence?chatId=..  an answer with a fenced block containing [1]
 *   POST {url}/stop?chatId=..          ends the slow stream with a "stopped" done
 */
import http from "node:http";

let n = 0x500000;
const oid = () => (Date.now().toString(16).slice(-8) + (n++).toString(16)).padEnd(24, "0").slice(0, 24);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function message(chatId, role, content, extra = {}) {
  const id = extra.id ?? oid();
  return {
    id,
    _id: id,
    chatId,
    parentId: null,
    role,
    content,
    status: "complete",
    mode: "chat",
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
    model: role === "assistant" ? { provider: "gemini", id: "gemini-2.5-flash", usingOwnKey: false } : null,
    metrics: null,
    feedback: null,
    error: null,
    ...extra,
  };
}

export const FENCE_ANSWER =
  "Use the first element of the list [1].\n\n```js\nconst first = rows[1];\n```\n\nInline `arr[1]` stays literal too.";

export async function startChatScenarios() {
  const stops = new Set();

  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin ?? "http://localhost:3100";
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") return res.writeHead(204).end();

    const url = new URL(req.url ?? "/", "http://localhost");
    const chatId = url.searchParams.get("chatId") ?? "chat";
    let body = "";
    for await (const chunk of req) body += chunk;
    let content = "";
    try {
      content = JSON.parse(body || "{}").content ?? "";
    } catch {
      /* ignore */
    }

    if (url.pathname === "/stop") {
      stops.add(chatId);
      res.writeHead(202, { "Content-Type": "application/json" }).end(JSON.stringify({ stopped: true }));
      return;
    }

    if (!url.pathname.startsWith("/stream/")) return res.writeHead(404).end();

    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
    let closed = false;
    req.on("close", () => (closed = true));
    const emit = (ev) => !closed && res.write(`data: ${JSON.stringify(ev)}\n\n`);

    const user = message(chatId, "user", content);
    const assistantId = oid();
    emit({ type: "start", chatId, userMessageId: user.id, assistantMessageId: assistantId, mode: "chat", requestId: oid() });
    emit({ type: "status", message: "Reading your data", code: "context.bridges" });
    await sleep(150);

    const finish = (text, status = "complete") => {
      const assistant = message(chatId, "assistant", text, { id: assistantId, parentId: user.id, status });
      emit({
        type: "done",
        message: {
          userMessage: user,
          assistantMessage: assistant,
          followUps: [],
          clarification: null,
          usedModel: "gemini-2.5-flash",
          exhausted: [],
          usage: { tier: "free", freeTierUsage: 13, freeTierLimit: 50 },
        },
      });
      res.end();
    };

    if (url.pathname === "/stream/fence") {
      for (const part of FENCE_ANSWER.match(/[\s\S]{1,12}/g)) {
        emit({ type: "token", text: part });
        await sleep(20);
      }
      return finish(FENCE_ANSWER);
    }

    // Slow stream: a long answer, one short line every 80ms, until stopped.
    let text = "";
    for (let i = 1; i <= 120 && !closed; i++) {
      if (stops.has(chatId)) {
        stops.delete(chatId);
        return finish(text, "stopped");
      }
      const line = `Line ${i} of a long answer about revenue.\n\n`;
      text += line;
      emit({ type: "token", text: line });
      await sleep(80);
    }
    finish(text);
  });

  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address();
  return {
    url: `http://localhost:${port}`,
    close: () => new Promise((r) => server.close(() => r())),
  };
}
