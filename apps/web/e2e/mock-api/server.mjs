#!/usr/bin/env node
/*
 * Tiny mock of the wuup API for e2e tests and screenshots.
 *
 *   node e2e/mock-api/server.mjs            # listens on :4100 (PORT env to change)
 *
 * Scenario selection (first match wins):
 *   1. Bearer token "scenario:<name>" (set localStorage wuup_token in the test;
 *      parallel-safe because every token gets its own in-memory state)
 *   2. header  x-mock-scenario: <name>
 *   3. global  GET|POST /__scenario?name=<name>   (default "withData")
 *   GET /__reset clears all state. POST /__expire (with the same Bearer) makes
 *   every later request for that token return 401.
 *
 * Scenarios: newUser, withData, longThread, streaming, research, clarification,
 *            streamError, freeTierExhausted, unauthorized
 *
 * POST /chats/:id/messages truly streams SSE frames with delays.
 */
import http from "node:http";
import { URL } from "node:url";

const PORT = Number(process.env.PORT ?? 4100);
const SCENARIOS = [
  "newUser",
  "withData",
  "longThread",
  "streaming",
  "research",
  "clarification",
  "streamError",
  "freeTierExhausted",
  "unauthorized",
];
let globalScenario = "withData";

// ─── Helpers ────────────────────────────────────────────────────────────────

let idCounter = 0x100000;
const oid = () => (Date.now().toString(16).slice(-8) + (idCounter++).toString(16)).padEnd(24, "0").slice(0, 24);
const iso = (msAgo = 0) => new Date(Date.now() - msAgo).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function message(chatId, role, content, extra = {}) {
  const id = oid();
  return {
    id,
    _id: id,
    chatId,
    parentId: null,
    role,
    content,
    status: "complete",
    mode: "chat",
    createdAt: iso(),
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
    metrics: role === "assistant" ? { latencyMs: 2140, firstTokenMs: 420, tokensIn: 1800, tokensOut: 240, toolCalls: 1 } : null,
    feedback: null,
    error: null,
    ...extra,
  };
}

function chat(title, msAgo, extra = {}) {
  const id = oid();
  return {
    id,
    _id: id,
    title,
    titleSource: "auto",
    pinned: false,
    bridgeIds: [],
    messageCount: 2,
    lastMessageAt: iso(msAgo),
    createdAt: iso(msAgo + 5 * MIN),
    ...extra,
  };
}

const ORDERS_QUERY = {
  tool: "mongo_aggregate",
  connectionName: "Shop production",
  db: "shop",
  collection: "orders",
  query: '[{"$match":{"status":"paid"}},{"$group":{"_id":{"$month":"$createdAt"},"revenue":{"$sum":"$total"}}},{"$sort":{"_id":1}}]',
  rowCount: 6,
  truncated: false,
  durationMs: 84,
};

const CHART = {
  type: "bar",
  xAxisKey: "month",
  yAxisKey: "revenue",
  title: "Paid revenue by month",
  series: [
    { month: "May", revenue: 182400 },
    { month: "Jun", revenue: 204950 },
    { month: "Jul", revenue: 197300 },
    { month: "Aug", revenue: 231800 },
    { month: "Sep", revenue: 248120 },
    { month: "Oct", revenue: 119640 },
  ],
};

function seedThread(c) {
  const u = message(c.id, "user", "What was paid revenue by month since May?");
  const a = message(
    c.id,
    "assistant",
    "Paid revenue grew steadily from **₹1.82L in May** to **₹2.48L in September**, a 36% rise. October is partial so far at ₹1.20L.\n\nThe chart below is built from the 6 rows the query returned.",
    {
      parentId: u.id,
      visualType: "chart",
      chartData: CHART,
      queries: [ORDERS_QUERY],
      sources: [{ n: 1, kind: "data", title: "shop.orders", cited: true, connectionName: "Shop production", db: "shop", collection: "orders", queryIndex: 0 }],
      followUps: [
        { label: "Break down by category", suggestedPrompt: "Break down September revenue by product category" },
        { label: "Compare to last year", suggestedPrompt: "Compare monthly paid revenue to the same months last year" },
      ],
    },
  );
  return [u, a];
}

function bridge(name, status, extra = {}) {
  const id = oid();
  return {
    id,
    _id: id,
    name,
    type: "mongodb",
    isSystem: false,
    scope: [{ db: "shop", collections: ["orders", "customers", "products"] }],
    redactedFields: { "shop.customers": ["password", "card.number"] },
    suggestions: ["Top 10 customers by lifetime value", "Orders per day this month"],
    status,
    lastError: status === "error" ? "Authentication failed. Check the username and password in the connection string." : null,
    lastScannedAt: iso(2 * HOUR),
    lastUsedAt: iso(30 * MIN),
    stats: { databases: 1, collections: 3 },
    sheets: null,
    createdAt: iso(5 * DAY),
    ...extra,
  };
}

function knowledgeDoc(name, status = "indexed") {
  const id = oid();
  return {
    id,
    _id: id,
    name,
    type: name.split(".").pop(),
    status,
    fileSize: 482_133,
    chunkCount: status === "indexed" ? 64 : 0,
    progress: status === "indexing" ? { done: 12, total: 64 } : null,
    errorMessage: null,
    truncated: false,
    canRetry: false,
    createdAt: iso(3 * DAY),
  };
}

// ─── Per-token state ────────────────────────────────────────────────────────

function createState(scenario) {
  const isNew = scenario === "newUser";
  const exhausted = scenario === "freeTierExhausted";
  const user = {
    id: oid(),
    email: isNew ? "new.user@example.com" : "asha.verma@example.com",
    name: isNew ? null : "Asha Verma",
    isDemo: false,
    demoExpiresAt: null,
    createdAt: iso(20 * DAY),
    plan: { tier: "free", provider: null, freeTierUsage: exhausted ? 50 : isNew ? 0 : 12, freeTierLimit: 50 },
    preferences: { aboutMe: "", responseStyle: "balanced", customInstructions: "", preferTables: false, showQueriesByDefault: false },
    onboarding: { welcomeSeenAt: isNew ? null : iso(10 * DAY), checklistDismissedAt: null },
  };

  const chats = [];
  const messages = new Map();
  if (!isNew) {
    const list = [
      chat("Monthly revenue since May", 25 * MIN, { pinned: true, titleSource: "user" }),
      chat("Churned customers in Q3", 2 * HOUR),
      chat("Refund rate by payment method", 5 * HOUR),
      chat("Inventory below reorder level", 26 * HOUR),
      chat("Top 10 customers by lifetime value", 30 * HOUR, { pinned: true }),
      chat("Average order value by city", 3 * DAY),
      chat("Late deliveries last week", 4 * DAY),
      chat("Signup to first order time", 6 * DAY),
      chat("Policy summary: returns PDF", 9 * DAY),
      chat("Sheet: marketing spend vs signups", 12 * DAY),
      chat("Product categories with falling sales", 20 * DAY),
      chat("Duplicate customer records", 34 * DAY),
    ];
    if (scenario === "longThread") list.unshift(chat("Quarterly business review prep", 3 * MIN, { messageCount: 60 }));
    for (const c of list) {
      chats.push(c);
      messages.set(c.id, seedThread(c));
    }
    if (scenario === "longThread") {
      const c = list[0];
      const msgs = [];
      for (let i = 0; i < 30; i++) {
        const [u, a] = seedThread(c);
        u.content = `Question ${i + 1}: ${u.content}`;
        u.createdAt = iso((60 - i * 2) * MIN);
        a.createdAt = iso((59 - i * 2) * MIN);
        msgs.push(u, a);
      }
      messages.set(c.id, msgs);
    }
    // 30 more older chats so infinite scroll has a second page.
    for (let i = 0; i < 30; i++) {
      const c = chat(`Archived analysis ${i + 1}`, (40 + i) * DAY);
      chats.push(c);
      messages.set(c.id, seedThread(c));
    }
  }

  const bridges = isNew
    ? []
    : [bridge("Shop production", "active"), bridge("Analytics replica", scenario === "withData" ? "error" : "active")];
  const knowledge = isNew ? [] : [knowledgeDoc("returns-policy.pdf"), knowledgeDoc("pricing-faq.txt")];

  return { scenario, user, chats, messages, bridges, knowledge, apiKey: null };
}

const states = new Map();

function resolve(req) {
  const auth = req.headers.authorization ?? "";
  const m = /^Bearer\s+scenario:([A-Za-z]+)/.exec(auth);
  const headerScenario = req.headers["x-mock-scenario"];
  const scenario = m?.[1] ?? (typeof headerScenario === "string" ? headerScenario : null) ?? globalScenario;
  const key = m ? auth : `global:${scenario}`;
  if (!states.has(key)) states.set(key, createState(scenario));
  return states.get(key);
}

// ─── HTTP plumbing ──────────────────────────────────────────────────────────

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, x-mock-scenario");
  res.setHeader("Access-Control-Expose-Headers", "Retry-After");
}

function send(res, status, body) {
  if (body === undefined) {
    res.writeHead(status);
    res.end();
    return;
  }
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const err = (res, status, code, message, extra = {}) => send(res, status, { error: message, code, ...extra });

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

function usage(state) {
  const { plan } = state.user;
  const byok = plan.tier === "byok";
  return {
    plan: {
      tier: plan.tier,
      limit: byok ? null : plan.freeTierLimit,
      used: plan.freeTierUsage,
      remaining: byok ? null : Math.max(0, plan.freeTierLimit - plan.freeTierUsage),
      researchCost: 3,
    },
    apiKey: state.apiKey,
    daily: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * DAY).toISOString().slice(0, 10),
      messages: (i * 7) % 5,
      research: i % 9 === 0 ? 1 : 0,
      tokensIn: 1200 * ((i * 7) % 5),
      tokensOut: 300 * ((i * 7) % 5),
    })),
    totals: { messages: 52, research: 3, tokensIn: 62400, tokensOut: 15600 },
    limits: { maxUploadMb: 10, maxSources: 20, maxChunks: 2000, chunksUsed: 128, maxRowsPerQuery: 100, queryTimeoutMs: 10000 },
    counts: { bridges: state.bridges.length, documents: state.knowledge.length, chats: state.chats.length },
    freeTierUsage: plan.freeTierUsage,
    freeTierLimit: plan.freeTierLimit,
    hasCustomKey: byok,
    availableModels: ["gemini-2.5-flash"],
  };
}

// ─── SSE ────────────────────────────────────────────────────────────────────

async function streamAnswer(req, res, state, c, body) {
  const scenario = state.scenario;
  if (scenario === "freeTierExhausted") {
    return err(res, 402, "FREE_LIMIT_REACHED", "You've used all 50 free answers. Add your own key to keep going.");
  }
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  let closed = false;
  req.on("close", () => {
    closed = true;
  });
  const emit = (ev) => {
    if (!closed) res.write(`data: ${JSON.stringify(ev)}\n\n`);
  };
  const ping = setInterval(() => !closed && res.write(": ping\n\n"), 5000);

  const mode = body.mode === "research" || scenario === "research" ? "research" : "chat";
  const userMsg = message(c.id, "user", String(body.content ?? ""), { mode });
  const assistantId = oid();
  emit({ type: "start", chatId: c.id, userMessageId: userMsg.id, assistantMessageId: assistantId, mode, requestId: oid() });
  await sleep(250);

  if (c.messageCount === 0 && c.titleSource === "auto") {
    c.title = String(body.content ?? "New chat").slice(0, 48);
    emit({ type: "title", chatId: c.id, title: c.title });
  }

  const steps = [];
  if (mode === "research") {
    emit({ type: "status", message: "Planning the research", code: "research.plan" });
    const titles = ["Find paid orders since May", "Group revenue by month", "Check refunds and partial months", "Write the report"];
    for (const [i, title] of titles.entries()) {
      const step = { id: `s${i}`, title, status: "running", detail: null, sourceNs: [], startedAt: iso(), finishedAt: null };
      emit({ type: "step", step });
      await sleep(500);
      const done = { ...step, status: "done", detail: "6 rows", sourceNs: [1], finishedAt: iso() };
      steps.push(done);
      emit({ type: "step", step: done });
    }
    emit({ type: "status", message: "Writing the report", code: "research.report" });
  } else {
    emit({ type: "status", message: "Reading your data", code: "context.bridges" });
    await sleep(300);
  }

  emit({ type: "tool", id: "t1", name: "mongo_aggregate", label: "Querying shop.orders", state: "running", query: ORDERS_QUERY.query });
  await sleep(600);
  emit({ type: "tool", id: "t1", name: "mongo_aggregate", label: "Queried shop.orders (6 rows)", state: "done", query: ORDERS_QUERY.query });
  const sources = [{ n: 1, kind: "data", title: "shop.orders", cited: true, connectionName: "Shop production", db: "shop", collection: "orders", queryIndex: 0 }];
  emit({ type: "sources", sources });

  if (scenario === "streamError") {
    await sleep(300);
    for (const t of ["Paid revenue ", "grew from "]) {
      emit({ type: "token", text: t });
      await sleep(120);
    }
    const partial = message(c.id, "assistant", "Paid revenue grew from ", { id: assistantId, _id: assistantId, status: "error", error: { code: "PROVIDER_ERROR", message: "The model stopped responding." } });
    emit({ type: "error", code: "PROVIDER_ERROR", message: "The model stopped responding. Try again.", retryable: true, assistantMessage: partial });
    clearInterval(ping);
    return res.end();
  }

  const clarify = scenario === "clarification";
  const text = clarify
    ? "I can answer that two ways. Which revenue do you mean?"
    : "Paid revenue grew steadily from **₹1.82L in May** to **₹2.48L in September**, a 36% rise. October is partial so far at ₹1.20L.\n\n| Month | Revenue |\n|---|---|\n| May | ₹1,82,400 |\n| Sep | ₹2,48,120 |\n\nThe chart is built from the 6 rows the query returned [1].";
  const words = text.split(/(\s+)/);
  for (let i = 0; i < words.length; i += 3) {
    if (closed) break;
    emit({ type: "token", text: words.slice(i, i + 3).join("") });
    await sleep(45);
  }

  const assistant = message(c.id, "assistant", text, {
    id: assistantId,
    _id: assistantId,
    parentId: userMsg.id,
    mode,
    visualType: clarify ? "none" : "chart",
    chartData: clarify ? null : CHART,
    queries: [ORDERS_QUERY],
    sources,
    research: mode === "research" ? { steps, durationMs: 4200 } : null,
    clarification: clarify ? { question: "Which revenue do you mean?", options: ["Gross order value", "Paid revenue after refunds"], allowFreeText: true } : null,
    followUps: clarify ? [] : [{ label: "Break down by category", suggestedPrompt: "Break down September revenue by product category" }],
  });
  const list = state.messages.get(c.id) ?? [];
  list.push(userMsg, assistant);
  state.messages.set(c.id, list);
  c.messageCount = list.length;
  c.lastMessageAt = iso();
  state.user.plan.freeTierUsage += mode === "research" ? 3 : 1;

  emit({
    type: "done",
    message: {
      userMessage: userMsg,
      assistantMessage: assistant,
      followUps: assistant.followUps,
      clarification: assistant.clarification,
      usedModel: "gemini-2.5-flash",
      exhausted: [],
      usage: { tier: "free", freeTierUsage: state.user.plan.freeTierUsage, freeTierLimit: state.user.plan.freeTierLimit },
    },
  });
  clearInterval(ping);
  res.end();
}

// ─── Router ─────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") return send(res, 204);
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = req.method ?? "GET";

  // Control endpoints
  if (path === "/__scenario") {
    const name = url.searchParams.get("name");
    if (name && SCENARIOS.includes(name)) globalScenario = name;
    return send(res, 200, { scenario: globalScenario, scenarios: SCENARIOS });
  }
  if (path === "/__reset") {
    states.clear();
    globalScenario = "withData";
    return send(res, 200, { ok: true });
  }
  if (path === "/" || path === "/health") return send(res, 200, { status: "healthy", timestamp: iso() });
  if (path === "/meta") {
    return send(res, 200, {
      version: "mock",
      features: ["research", "regenerate", "feedback", "sheets", "sample", "search", "export"],
      limits: { maxPromptChars: 8000, freeTierLimit: 50 },
    });
  }

  const state = resolve(req);
  // Test hook: end this token's session so the next request gets a 401.
  if (path === "/__expire") {
    state.expired = true;
    return send(res, 200, { ok: true });
  }
  if (path === "/auth/logout") return send(res, 204);
  if (path === "/auth/login" || path === "/auth/signup" || path === "/auth/demo") {
    return send(res, 200, { user: state.user, token: `scenario:${state.scenario}` });
  }
  if (state.scenario === "unauthorized" || state.expired) return err(res, 401, "UNAUTHENTICATED", "Your session ended. Log in again.");

  let m;
  try {
    if ((path === "/auth/me" || path === "/auth/verify") && method === "GET") return send(res, 200, { user: state.user });

    // User
    if (path === "/user/usage") return send(res, 200, usage(state));
    if (path === "/user/models") {
      return send(res, 200, {
        provider: "gemini",
        usingOwnKey: false,
        models: [
          { id: "auto", label: "Auto", provider: "gemini", available: true, cooldownUntil: null },
          { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "gemini", available: true, cooldownUntil: null },
        ],
      });
    }
    if (path === "/user/preferences" && method === "PATCH") {
      const body = await readJson(req);
      const { onboarding, ...prefs } = body;
      Object.assign(state.user.preferences, prefs);
      if (onboarding?.welcomeSeen) state.user.onboarding.welcomeSeenAt = iso();
      if (onboarding?.checklistDismissed) state.user.onboarding.checklistDismissedAt = iso();
      return send(res, 200, { user: state.user });
    }
    if (path === "/user/profile" && method === "PATCH") {
      const body = await readJson(req);
      if (body.name) state.user.name = body.name;
      return send(res, 200, { user: state.user });
    }
    if (path === "/user/api-key" && method === "PUT") {
      const body = await readJson(req);
      state.apiKey = { provider: body.provider ?? "gemini", maskedKey: "sk-...a1b2" };
      state.user.plan.tier = "byok";
      state.user.plan.provider = state.apiKey.provider;
      return send(res, 200, { user: state.user, apiKey: state.apiKey });
    }
    if (path === "/user/api-key" && method === "DELETE") {
      state.apiKey = null;
      state.user.plan.tier = "free";
      state.user.plan.provider = null;
      return send(res, 204);
    }

    // Chats
    if (path === "/chats" && method === "GET") {
      const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
      const limit = Math.min(50, Number(url.searchParams.get("limit") ?? 30));
      const cursor = url.searchParams.get("cursor");
      let list = [...state.chats].sort((a, b) => (b.lastMessageAt > a.lastMessageAt ? 1 : -1));
      if (q) {
        list = list
          .map((c) => {
            if (c.title.toLowerCase().includes(q)) return { ...c, match: { messageId: null, snippet: c.title } };
            const hit = (state.messages.get(c.id) ?? []).find((msg) => msg.content.toLowerCase().includes(q));
            if (!hit) return null;
            const i = hit.content.toLowerCase().indexOf(q);
            const snippet = hit.content.slice(Math.max(0, i - 40), i + q.length + 60).replace(/\*\*/g, "");
            return { ...c, match: { messageId: hit.id, snippet } };
          })
          .filter(Boolean);
      }
      if (!url.searchParams.has("limit") && !cursor && !q) return send(res, 200, list);
      const start = cursor ? Number(cursor) : 0;
      const items = list.slice(start, start + limit);
      const next = start + limit < list.length ? String(start + limit) : null;
      await sleep(q ? 150 : 60);
      return send(res, 200, { items, nextCursor: next });
    }
    if (path === "/chats" && method === "POST") {
      const body = await readJson(req);
      const c = chat(body.title ?? "New chat", 0, { messageCount: 0, bridgeIds: body.bridgeIds ?? [] });
      state.chats.unshift(c);
      state.messages.set(c.id, []);
      return send(res, 201, c);
    }
    if (path === "/chats" && method === "DELETE") {
      state.chats = [];
      state.messages.clear();
      return send(res, 204);
    }
    if ((m = /^\/chats\/([^/]+)$/.exec(path))) {
      const c = state.chats.find((x) => x.id === m[1]);
      if (!c) return err(res, 404, "NOT_FOUND", "That chat doesn't exist.");
      if (method === "GET") return send(res, 200, c);
      if (method === "PATCH") {
        const body = await readJson(req);
        if (typeof body.title === "string") {
          c.title = body.title;
          c.titleSource = "user";
        }
        if (typeof body.pinned === "boolean") c.pinned = body.pinned;
        if (Array.isArray(body.bridgeIds)) c.bridgeIds = body.bridgeIds;
        await sleep(120);
        return send(res, 200, c);
      }
      if (method === "DELETE") {
        state.chats = state.chats.filter((x) => x.id !== c.id);
        state.messages.delete(c.id);
        await sleep(120);
        return send(res, 204);
      }
    }
    if ((m = /^\/chats\/([^/]+)\/messages$/.exec(path))) {
      const c = state.chats.find((x) => x.id === m[1]);
      if (!c) return err(res, 404, "NOT_FOUND", "That chat doesn't exist.");
      if (method === "GET") {
        const all = state.messages.get(c.id) ?? [];
        const limit = Number(url.searchParams.get("limit") ?? 50);
        const before = url.searchParams.get("before");
        let end = all.length;
        if (before) {
          const idx = all.findIndex((x) => x.id === before);
          if (idx >= 0) end = idx;
        }
        const start = Math.max(0, end - limit);
        return send(res, 200, { items: all.slice(start, end), nextCursor: start > 0 ? all[start].id : null });
      }
      if (method === "POST") return streamAnswer(req, res, state, c, await readJson(req));
    }
    if ((m = /^\/chats\/([^/]+)\/stop$/.exec(path))) return send(res, 200, { stopped: true });
    if ((m = /^\/chats\/([^/]+)\/messages\/([^/]+)\/regenerate$/.exec(path))) {
      const c = state.chats.find((x) => x.id === m[1]);
      if (!c) return err(res, 404, "NOT_FOUND", "That chat doesn't exist.");
      return streamAnswer(req, res, state, c, { content: "Regenerate", ...(await readJson(req)) });
    }
    if ((m = /^\/chats\/([^/]+)\/messages\/([^/]+)\/feedback$/.exec(path))) {
      const body = await readJson(req);
      return send(res, 200, { feedback: body.rating ? { rating: body.rating, note: body.note ?? null, at: iso() } : null });
    }
    if ((m = /^\/chats\/([^/]+)\/export$/.exec(path))) {
      res.writeHead(200, { "Content-Type": "text/markdown" });
      return res.end("# Export\n\nMock export.\n");
    }

    // Connections
    if (path === "/connections" && method === "GET") return send(res, 200, state.bridges);
    if (path === "/connections/sheets/service-account") return send(res, 200, { email: "wuup-reader@wuup-mock.iam.gserviceaccount.com" });
    if (path === "/connections/test" && method === "POST") {
      await sleep(400);
      return send(res, 200, {
        ok: true,
        type: "mongodb",
        databases: [{ db: "shop", collections: [{ name: "orders", count: 18240 }, { name: "customers", count: 3120 }, { name: "products", count: 412 }] }],
        sensitive: { "shop.customers": ["password", "card.number"] },
      });
    }
    if (path === "/connections" && method === "POST") {
      const body = await readJson(req);
      const b = bridge(body.name ?? "New source", "active");
      state.bridges.push(b);
      return send(res, 201, { bridge: b, ...b });
    }
    if (path === "/connections/sample" && method === "POST") {
      const b = bridge("Sample store", "active", { isSystem: true });
      state.bridges.push(b);
      return send(res, 201, { bridge: b, ...b });
    }
    if ((m = /^\/connections\/([^/]+)(\/refresh)?$/.exec(path))) {
      const b = state.bridges.find((x) => x.id === m[1]);
      if (!b) return err(res, 404, "NOT_FOUND", "That data source doesn't exist.");
      if (m[2]) {
        b.status = "active";
        b.lastError = null;
        return send(res, 200, b);
      }
      if (method === "GET") {
        return send(res, 200, {
          ...b,
          schema: [
            {
              db: "shop",
              collections: [
                { name: "orders", count: 18240, fields: [{ path: "_id", types: ["objectId"], pct: 100 }, { path: "total", types: ["number"], pct: 100 }, { path: "status", types: ["string"], pct: 100 }, { path: "createdAt", types: ["date"], pct: 100 }] },
                { name: "customers", count: 3120, fields: [{ path: "email", types: ["string"], pct: 100 }, { path: "password", types: ["string"], pct: 100 }] },
              ],
            },
          ],
        });
      }
      if (method === "PATCH") {
        Object.assign(b, await readJson(req));
        return send(res, 200, b);
      }
      if (method === "DELETE") {
        state.bridges = state.bridges.filter((x) => x.id !== b.id);
        return send(res, 204);
      }
    }

    // Knowledge
    if (path === "/knowledge" && method === "GET") return send(res, 200, state.knowledge);
    if (path === "/knowledge/config") {
      return send(res, 200, { maxFileMb: 10, allowedExtensions: [".pdf", ".txt", ".md", ".csv", ".docx"], maxSources: 20, maxChunks: 2000 });
    }
    if (path === "/knowledge/upload" && method === "POST") {
      await new Promise((r) => {
        req.on("end", r);
        req.resume();
      });
      const d = knowledgeDoc("uploaded.pdf", "indexing");
      state.knowledge.unshift(d);
      return send(res, 201, { source: d, sourceId: d.id, name: d.name, status: d.status });
    }
    if ((m = /^\/knowledge\/([^/]+)(\/retry)?$/.exec(path))) {
      const d = state.knowledge.find((x) => x.id === m[1]);
      if (!d) return err(res, 404, "NOT_FOUND", "That document doesn't exist.");
      if (method === "DELETE") {
        state.knowledge = state.knowledge.filter((x) => x.id !== d.id);
        return send(res, 204);
      }
      return send(res, 200, d);
    }

    return err(res, 404, "NOT_FOUND", `Mock has no route for ${method} ${path}`);
  } catch (e) {
    console.error(e);
    return err(res, 500, "INTERNAL", "Mock server error");
  }
});

server.listen(PORT, () => {
  console.log(`wuup mock API on http://localhost:${PORT} (scenario: ${globalScenario})`);
});
