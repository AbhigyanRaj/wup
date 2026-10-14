/**
 * In-browser mock of the wuup API for the data sources and settings screens
 * (APP-4). Installed with Playwright's `page.route`, so it needs no server:
 *
 *   import { installDataMocks } from "./mock-api/data-scenarios.mjs";
 *   const mock = await installDataMocks(page, { scenario: "full" });
 *   mock.calls  // every request seen: [{ method, path, body }]
 *
 * Scenarios:
 *   full   three bridges (one sample), three documents (ready, indexing, failed)
 *   empty  no bridges, no documents
 */

/** A port nothing listens on: every request is answered by page.route, never the network. */
export const API = process.env.DATA_MOCK_API_URL ?? "http://localhost:4199";

const now = Date.now();
const iso = (msAgo) => new Date(now - msAgo).toISOString();
const H = 3600_000;

export function makeUser(overrides = {}) {
  return {
    id: "u1".padEnd(24, "0"),
    email: "asha@example.com",
    name: "Asha Verma",
    isDemo: false,
    demoExpiresAt: null,
    createdAt: iso(40 * 24 * H),
    plan: { tier: "free", provider: null, freeTierUsage: 18, freeTierLimit: 50 },
    preferences: {
      aboutMe: "",
      responseStyle: "balanced",
      customInstructions: "",
      preferTables: false,
      showQueriesByDefault: false,
    },
    onboarding: { welcomeSeenAt: iso(H), checklistDismissedAt: iso(H) },
    ...overrides,
  };
}

function bridge(p) {
  const id = p.id;
  return {
    id,
    _id: id,
    name: p.name,
    type: p.type ?? "mongodb",
    isSystem: p.isSystem ?? false,
    scope: p.scope ?? [],
    redactedFields: p.redactedFields ?? {},
    suggestions: p.suggestions ?? [],
    status: p.status ?? "active",
    lastError: p.lastError ?? null,
    lastScannedAt: p.lastScannedAt ?? iso(2 * H),
    lastUsedAt: p.lastUsedAt ?? null,
    stats: p.stats ?? { databases: 1, collections: 3 },
    sheets: p.sheets ?? null,
    createdAt: iso(5 * 24 * H),
    schema: p.schema ?? [],
  };
}

const f = (path, types, pct = 100) => ({ path, types, pct });

function seedBridges() {
  return [
    bridge({
      id: "b1".padEnd(24, "0"),
      name: "Production orders",
      redactedFields: { "shop.customers": ["email", "phone"] },
      suggestions: [
        "How many orders were placed last week?",
        "Which 5 products earned the most revenue this month?",
        "What is the average order value by country?",
      ],
      lastUsedAt: iso(20 * 60_000),
      stats: { databases: 2, collections: 5 },
      scope: [{ db: "shop", collections: ["*"] }, { db: "analytics", collections: ["events", "sessions_daily"] }],
      schema: [
        {
          db: "shop",
          collections: [
            {
              name: "orders",
              count: 48213,
              fields: [
                f("_id", ["objectId"]),
                f("customerId", ["objectId"]),
                f("total", ["double"]),
                f("status", ["string"]),
                f("country", ["string"], 97),
                f("createdAt", ["date"]),
                f("items.sku", ["string"]),
                f("items.qty", ["int"]),
              ],
            },
            {
              name: "customers",
              count: 9120,
              fields: [f("_id", ["objectId"]), f("name", ["string"]), f("email", ["string"]), f("phone", ["string"], 61), f("tier", ["string"])],
            },
            { name: "products", count: 412, fields: [f("_id", ["objectId"]), f("title", ["string"]), f("price", ["double"]), f("category", ["string"])] },
          ],
        },
        {
          db: "analytics",
          collections: [
            { name: "events", count: 1203311, fields: [f("type", ["string"]), f("ts", ["date"]), f("userId", ["objectId"], 88)] },
            { name: "sessions_daily", count: 365, fields: [f("day", ["date"]), f("count", ["int"])] },
          ],
        },
      ],
    }),
    bridge({
      id: "b2".padEnd(24, "0"),
      name: "Marketing budget 2026",
      type: "sheets",
      lastUsedAt: iso(3 * 24 * H),
      stats: { databases: 1, collections: 3 },
      suggestions: ["Which channel has the lowest cost per lead?", "Total spend by month"],
      sheets: {
        title: "Marketing budget 2026",
        tabs: [
          { name: "Spend", rows: 214, cols: 6, headers: ["Month", "Channel", "Spend", "Leads", "Owner", "Notes"] },
          { name: "Targets", rows: 12, cols: 4, headers: ["Quarter", "Target", "Actual", "Gap"] },
          { name: "Vendors", rows: 38, cols: 3, headers: ["Vendor", "Contract", "Renewal"] },
        ],
      },
    }),
    bridge({
      id: "b3".padEnd(24, "0"),
      name: "Sample store",
      isSystem: true,
      lastScannedAt: iso(26 * H),
      stats: { databases: 1, collections: 2 },
      suggestions: ["What are the best selling categories?"],
      schema: [
        {
          db: "sample_store",
          collections: [
            { name: "sales", count: 5000, fields: [f("item", ["string"]), f("price", ["double"]), f("storeLocation", ["string"])] },
            { name: "stores", count: 12, fields: [f("city", ["string"]), f("opened", ["date"])] },
          ],
        },
      ],
    }),
  ];
}

function doc(p) {
  return {
    id: p.id,
    _id: p.id,
    name: p.name,
    type: p.type ?? "pdf",
    status: p.status ?? "indexed",
    fileSize: p.fileSize ?? 1_240_000,
    chunkCount: p.chunkCount ?? 0,
    progress: p.progress ?? null,
    errorMessage: p.errorMessage ?? null,
    truncated: p.truncated ?? false,
    canRetry: p.canRetry ?? (p.status === "error" || p.status === "error_quota"),
    createdAt: p.createdAt ?? iso(3 * 24 * H),
    updatedAt: iso(H),
  };
}

function seedDocs() {
  return [
    doc({ id: "d1".padEnd(24, "0"), name: "Q3 board report.pdf", chunkCount: 86, fileSize: 2_840_000 }),
    doc({ id: "d2".padEnd(24, "0"), name: "Refund policy.md", type: "md", status: "indexing", progress: { done: 12, total: 40 }, fileSize: 48_000, createdAt: iso(60_000) }),
    doc({ id: "d3".padEnd(24, "0"), name: "Scanned invoice.pdf", status: "error", errorMessage: "No text found. This PDF looks like a scanned image.", fileSize: 5_100_000, createdAt: iso(26 * H) }),
  ];
}

const MONGO_TEST = {
  ok: true,
  type: "mongodb",
  defaultDb: "shop",
  databases: [
    {
      db: "shop",
      collections: [
        { name: "orders", count: 48213, type: "collection" },
        { name: "customers", count: 9120, type: "collection" },
        { name: "products", count: 412, type: "collection" },
        { name: "sessions", count: 88120, type: "collection" },
        { name: "order_totals", count: null, type: "view" },
      ],
    },
    { db: "analytics", collections: [{ name: "events", count: 1203311, type: "collection" }, { name: "migrations", count: 14, type: "collection" }] },
  ],
  sensitive: { "shop.customers": ["email", "phone", "passwordHash"], "shop.sessions": ["token"] },
};

const SHEETS_TEST = {
  ok: true,
  type: "sheets",
  spreadsheetId: "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789",
  title: "Sales pipeline",
  tabs: [
    { name: "Deals", rows: 342, cols: 8, headers: ["Deal", "Owner", "Stage", "Amount", "Close date"] },
    { name: "Reps", rows: 14, cols: 4, headers: ["Name", "Region", "Quota", "Team"] },
  ],
};

function usage(user, state) {
  const daily = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now - (29 - i) * 24 * H);
    const m = [0, 2, 5, 1, 0, 3, 7, 4, 2, 0, 1, 6, 9, 3, 2, 0, 0, 4, 5, 8, 2, 1, 3, 0, 2, 6, 4, 3, 5, 2][i];
    return { date: d.toISOString().slice(0, 10), messages: m, research: i % 9 === 0 ? 1 : 0, tokensIn: m * 1200, tokensOut: m * 400 };
  });
  const key = state.apiKey;
  return {
    plan: key
      ? { tier: "byok", limit: null, used: 18, remaining: null, researchCost: 3 }
      : { tier: user.isDemo ? "demo" : "free", limit: 50, used: 18, remaining: 32, researchCost: 3 },
    apiKey: key,
    daily,
    totals: { messages: 90, research: 4, tokensIn: 108000, tokensOut: 36000 },
    limits: { maxUploadMb: 20, maxSources: 50, maxChunks: 5000, chunksUsed: 1240, maxRowsPerQuery: 100, queryTimeoutMs: 10000 },
    counts: { bridges: state.bridges.length, documents: state.docs.length, chats: 12 },
    freeTierUsage: 18,
    freeTierLimit: 50,
    hasCustomKey: !!key,
    availableModels: [],
  };
}

function models(state) {
  const p = state.apiKey?.provider ?? "gemini";
  const own = !!state.apiKey;
  const list = {
    gemini: [["gemini-2.5-flash", "Gemini 2.5 Flash"], ["gemini-2.5-pro", "Gemini 2.5 Pro"]],
    openai: [["gpt-5-mini", "GPT-5 mini"], ["gpt-5", "GPT-5"]],
    anthropic: [["claude-sonnet", "Claude Sonnet"], ["claude-haiku", "Claude Haiku"]],
    openrouter: [["openrouter/auto", "OpenRouter Auto"]],
  }[p];
  return {
    provider: p,
    usingOwnKey: own,
    models: [
      { id: "auto", label: "Auto", provider: p, available: true, cooldownUntil: null },
      ...list.map(([id, label], i) => ({ id, label, provider: p, available: own || i === 0, cooldownUntil: null })),
    ],
  };
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ scenario?: "full"|"empty", user?: object, features?: string[], indexingNeverFinishes?: boolean, sheetsShared?: boolean }} [opts]
 */
export async function installDataMocks(page, opts = {}) {
  const scenario = opts.scenario ?? "full";
  const state = {
    user: makeUser(opts.user ?? {}),
    bridges: scenario === "empty" ? [] : seedBridges(),
    docs: scenario === "empty" ? [] : seedDocs(),
    apiKey: opts.apiKey ?? null,
    polls: {},
    created: 0,
    sheetsShared: opts.sheetsShared ?? false,
  };
  const calls = [];
  const features = opts.features ?? ["research", "regenerate", "feedback", "sheets", "sample", "search", "export"];

  await page.context().addCookies([{ name: "wuup_authed", value: "1", url: opts.baseURL ?? process.env.BASE_URL ?? "http://localhost:3000" }]);
  // Point the dev build at the mocked origin (src/lib/env.ts dev override) and skip the welcome dialog.
  await page.addInitScript((api) => {
    localStorage.setItem("wuup_dev_api_url", api);
    localStorage.setItem("wuup_token", "data-mock");
    localStorage.setItem("wuup_welcome_seen", "1");
  }, API);

  await page.route(`${API}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
    if (method === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": req.headers()["origin"] ?? "*",
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
        },
      });
    }
    let body = null;
    try {
      body = req.postDataJSON();
    } catch {
      body = req.postData();
    }
    calls.push({ method, path, body });
    const origin = req.headers()["origin"] ?? "http://localhost:3100";
    const reply = (status, b) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true" },
        body: b === undefined ? "" : JSON.stringify(b),
      });

    // ── auth / user ──
    if (path === "/auth/me" || path === "/auth/verify") return reply(200, { user: state.user });
    if (path === "/auth/logout") return reply(200, { ok: true });
    if (path === "/auth/change-password") {
      if (body?.currentPassword === "wrong-password") return reply(401, { error: "Your current password is incorrect.", code: "INVALID_CREDENTIALS" });
      return reply(200, { ok: true });
    }
    if (path === "/meta") return reply(200, { version: "test", features, limits: { maxPromptChars: 8000, freeTierLimit: 50 } });
    if (path === "/user/usage") return reply(200, usage(state.user, state));
    if (path === "/user/models") return reply(200, models(state));
    if (path === "/user/profile" && method === "PATCH") {
      state.user = { ...state.user, name: body.name };
      return reply(200, { user: state.user });
    }
    if (path === "/user/preferences" && method === "PATCH") {
      const rest = { ...(body ?? {}) };
      delete rest.onboarding;
      state.user = { ...state.user, preferences: { ...state.user.preferences, ...rest } };
      return reply(200, { user: state.user });
    }
    if (path === "/user/api-key" && method === "PUT") {
      if (String(body?.apiKey ?? "").includes("bad")) return reply(400, { error: "OpenAI rejected this key. Check it and try again.", code: "PROVIDER_AUTH" });
      const k = String(body.apiKey);
      state.apiKey = { provider: body.provider, maskedKey: `${k.slice(0, 3)}...${k.slice(-4)}` };
      return reply(200, { message: "Saved", maskedKey: state.apiKey.maskedKey });
    }
    if (path === "/user/api-key" && method === "DELETE") {
      state.apiKey = null;
      return reply(200, { message: "Removed" });
    }
    if (path === "/user/export") return reply(200, { user: state.user, chats: [], connections: state.bridges.length });
    if (path === "/user" && method === "DELETE") {
      if (body?.confirm !== "DELETE") return reply(400, { error: 'Type "DELETE" to confirm', code: "VALIDATION_FAILED" });
      if (!state.user.isDemo && body?.password !== "correct-horse") return reply(401, { error: "That password is incorrect.", code: "INVALID_CREDENTIALS" });
      return reply(200, { ok: true });
    }
    if (path === "/chats" && method === "DELETE") return reply(200, { deleted: 12 });
    if (path === "/chats") return reply(200, url.searchParams.has("limit") ? { items: [], nextCursor: null } : []);
    if (path === "/waitlist") return reply(200, { ok: true });

    // ── connections ──
    if (path === "/connections" && method === "GET") return reply(200, state.bridges.map((b) => ({ ...b, schema: undefined })));
    if (path === "/connections/sheets/service-account") return reply(200, { email: "wuup-reader@wuup-prod.iam.gserviceaccount.com" });
    if (path === "/connections/sample" && method === "POST") {
      const b = bridge({
        id: "bs".padEnd(24, "0"),
        name: "Sample store",
        isSystem: true,
        suggestions: ["What are the best selling categories?", "Revenue by store location"],
        stats: { databases: 1, collections: 2 },
      });
      state.bridges.push(b);
      return reply(201, { id: b.id, connection: b });
    }
    if (path === "/connections/test") {
      const cfg = String(body?.config ?? "");
      if (body?.type === "sheets") {
        if (!state.sheetsShared) return reply(403, { error: "The sheet is not shared with the service account.", code: "SHEETS_NOT_SHARED" });
        return reply(200, SHEETS_TEST);
      }
      if (cfg.includes("localhost") || cfg.includes("127.0.0.1")) return reply(400, { error: "Blocked host", code: "BRIDGE_BLOCKED_HOST" });
      if (cfg.includes("badauth")) return reply(502, { error: "bad auth : authentication failed", code: "BRIDGE_UNREACHABLE" });
      return reply(200, MONGO_TEST);
    }
    if (path === "/connections" && method === "POST") {
      state.created += 1;
      const id = `n${state.created}`.padEnd(24, "0");
      const isSheets = body.type === "sheets";
      const b = bridge({
        id,
        name: body.name,
        type: body.type,
        status: "scanning",
        scope: body.scope,
        redactedFields: body.redactedFields,
        lastScannedAt: null,
        stats: isSheets ? { databases: 1, collections: 2 } : { databases: 2, collections: 4 },
        sheets: isSheets ? { title: SHEETS_TEST.title, tabs: SHEETS_TEST.tabs } : null,
        suggestions: isSheets
          ? ["Which rep closed the most deals?", "Pipeline value by stage"]
          : ["How many orders were placed last week?", "Top 5 customers by total spend", "Orders by status this month"],
        schema: isSheets ? [] : seedBridges()[0].schema,
      });
      state.bridges.unshift(b);
      state.polls[id] = 0;
      return reply(201, { id, connection: b });
    }
    let m = path.match(/^\/connections\/([^/]+)(\/refresh)?$/);
    if (m) {
      const b = state.bridges.find((x) => x.id === m[1]);
      if (!b) return reply(404, { error: "Not found", code: "NOT_FOUND" });
      if (m[2]) {
        if (b.type !== "mongodb" && b.type !== "sheets") return reply(400, { error: "Only MongoDB and Sheets can refresh", code: "VALIDATION_FAILED" });
        b.status = "scanning";
        state.polls[b.id] = 0;
        return reply(202, { status: "scanning" });
      }
      if (method === "GET") {
        if (b.status === "scanning") {
          state.polls[b.id] = (state.polls[b.id] ?? 0) + 1;
          if (state.polls[b.id] >= 2) {
            b.status = "active";
            b.lastScannedAt = new Date().toISOString();
          }
        }
        return reply(200, b);
      }
      if (method === "PATCH") {
        if (body.name !== undefined) b.name = body.name;
        if (body.redactedFields !== undefined) b.redactedFields = body.redactedFields;
        if (body.scope !== undefined) b.scope = body.scope;
        return reply(200, { ...b, schema: undefined });
      }
      if (method === "DELETE") {
        if (opts.failDeletes) return reply(500, { error: "Database unavailable", code: "INTERNAL" });
        state.bridges = state.bridges.filter((x) => x.id !== b.id);
        return reply(200, { message: "Deleted" });
      }
    }

    // ── knowledge ──
    if (path === "/knowledge/config") return reply(200, { maxFileMb: 20, allowedExtensions: [".pdf", ".txt", ".md", ".csv", ".docx"], maxSources: 50, maxChunks: 5000 });
    if (path === "/knowledge" && method === "GET") {
      // Advance indexing rows a little on every list call (never fails).
      for (const d of state.docs) {
        if (d.status === "indexing" && d.progress && !opts.indexingNeverFinishes) {
          d.progress = { ...d.progress, done: Math.min(d.progress.total, d.progress.done + 7) };
          if (d.progress.done >= d.progress.total) {
            d.status = "indexed";
            d.chunkCount = d.progress.total;
            d.progress = null;
          }
        }
      }
      return reply(200, state.docs);
    }
    if (path === "/knowledge/upload") {
      const raw = req.postData() ?? "";
      if (raw.includes("duplicate.pdf")) return reply(409, { error: "You already uploaded this file.", code: "CONFLICT" });
      const name = (raw.match(/filename="([^"]+)"/) ?? [])[1] ?? "upload.pdf";
      const d = doc({
        id: `k${state.docs.length + 1}`.padEnd(24, "0"),
        name,
        type: name.split(".").pop(),
        status: "pending",
        fileSize: raw.length,
        createdAt: new Date().toISOString(),
      });
      state.docs.unshift(d);
      state.polls[d.id] = 0;
      return reply(202, { source: d, sourceId: d.id, name: d.name, status: d.status });
    }
    m = path.match(/^\/knowledge\/([^/]+)(\/retry|\/status)?$/);
    if (m) {
      const d = state.docs.find((x) => x.id === m[1]);
      if (!d) return reply(404, { error: "Not found", code: "NOT_FOUND" });
      if (m[2] === "/retry") {
        Object.assign(d, { status: "pending", errorMessage: null, progress: null, canRetry: false });
        state.polls[d.id] = 0;
        return reply(202, { source: d });
      }
      if (method === "DELETE") {
        state.docs = state.docs.filter((x) => x.id !== d.id);
        return reply(200, { message: "Deleted" });
      }
      // GET: pending -> indexing with progress -> indexed (unless it never finishes)
      state.polls[d.id] = (state.polls[d.id] ?? 0) + 1;
      const n = state.polls[d.id];
      if (d.status === "pending" || d.status === "indexing") {
        d.status = "indexing";
        d.progress = { done: Math.min(40, n * 12), total: 40 };
        if (!opts.indexingNeverFinishes && n >= 4) {
          d.status = "indexed";
          d.chunkCount = 40;
          d.progress = null;
        }
      }
      return reply(200, d);
    }

    return reply(404, { error: `No mock for ${method} ${path}`, code: "NOT_FOUND" });
  });

  return { state, calls };
}
