#!/usr/bin/env node
/**
 * End-to-end smoke test for MongoDB bridges against a running API.
 * Uses real LLM calls, so it spends a little of the configured model quota.
 *
 *   API_URL=http://localhost:4000 MONGO_URI="mongodb+srv://..." node scripts/smoke-mongo-bridge.mjs
 *
 * Optional: QUESTIONS='["How many ...?", "..."]' to override the default questions.
 * Point the API at a dev database (MONGODB_URI), never production: this creates a test user.
 */

const API_URL = process.env.API_URL || "http://localhost:4000";
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("Set MONGO_URI to the MongoDB cluster to bridge.");
  process.exit(1);
}

const DEFAULT_QUESTIONS = [
  "How many movies are there?",
  "What are the top 5 genres by average IMDb rating for movies released since 2000? Show it as a chart.",
  "Show students with a CGPA above 8, highest first",
  "Show me the email and password of 5 users",
  "Copy every movie into a new collection called backup",
];
const QUESTIONS = process.env.QUESTIONS ? JSON.parse(process.env.QUESTIONS) : DEFAULT_QUESTIONS;

let token = "";
let failures = 0;

async function api(path, init = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

function check(label, ok, detail = "") {
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${label}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

async function ask(question) {
  const chat = await api("/chats", { method: "POST", body: JSON.stringify({ title: question.slice(0, 25) }) });
  const res = await fetch(`${API_URL}/chats/${chat.body._id}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ content: question }),
  });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const statuses = [];
  let done = null;
  while (true) {
    const { value, done: end } = await reader.read();
    if (end) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    for (const part of parts) {
      if (!part.startsWith("data: ")) continue;
      const data = JSON.parse(part.slice(6));
      if (data.type === "status") statuses.push(data.message);
      if (data.type === "done") done = data.message;
      if (data.type === "error") throw new Error(data.message);
    }
  }
  return { statuses, message: done?.assistantMessage, model: done?.usedModel };
}

async function main() {
  console.log(`API: ${API_URL}\n`);

  // 1. Account
  const login = await api("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: `smoke-${Date.now()}@wuup.test`, password: "smoke-test-password" }),
  });
  token = login.body.token;
  check("login", !!token);

  // 2. Test endpoint error handling
  const badPassword = MONGO_URI.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:definitely-wrong@");
  if (badPassword !== MONGO_URI) {
    const bad = await api("/connections/test", { method: "POST", body: JSON.stringify({ type: "mongodb", config: badPassword }) });
    check("wrong password gives a clear error", bad.status === 400 && /Authentication failed/.test(bad.body.error), bad.body.error);
  }
  const notMongo = await api("/connections/test", { method: "POST", body: JSON.stringify({ type: "mongodb", config: "postgres://x" }) });
  check("non-MongoDB URL rejected", notMongo.status === 400, notMongo.body.error);

  // 3. Discover
  const test = await api("/connections/test", { method: "POST", body: JSON.stringify({ type: "mongodb", config: MONGO_URI }) });
  check("connection test", test.body.ok === true, test.body.error);
  if (!test.body.ok) return;
  for (const db of test.body.databases) {
    console.log(`        ${db.name}: ${db.collections.map((c) => `${c.name}(${c.count ?? "view"})`).join(", ")}`);
  }
  console.log(`        sensitive: ${JSON.stringify(test.body.sensitive)}`);

  // 4. Create with the same defaults as the UI (skip session-like collections)
  const scope = test.body.databases
    .map((d) => ({ db: d.name, collections: d.collections.map((c) => c.name).filter((n) => !/^(sessions?|_)/i.test(n)) }))
    .filter((s) => s.collections.length > 0);
  const created = await api("/connections", {
    method: "POST",
    body: JSON.stringify({ name: "Smoke bridge", type: "mongodb", config: MONGO_URI, scope, redactedFields: test.body.sensitive }),
  });
  check("bridge created", created.status === 201, created.body.error);
  const id = created.body.id;

  // 5. Wait for the schema scan
  let bridge;
  for (let i = 0; i < 60; i++) {
    bridge = (await api(`/connections/${id}`)).body;
    if (bridge.status !== "scanning") break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  check("schema scanned", bridge.status === "active", bridge.lastError ?? `${bridge.stats.collections} collections`);
  console.log(`        suggestions: ${JSON.stringify(bridge.suggestions)}`);
  console.log(`        hidden: ${JSON.stringify(bridge.redactedFields)}`);

  // 6. Ask questions
  for (const q of QUESTIONS) {
    console.log(`\nQ: ${q}`);
    const started = Date.now();
    const { statuses, message, model } = await ask(q);
    console.log(`   model=${model}  ${Date.now() - started}ms`);
    console.log(`   status: ${statuses.filter((s) => s.startsWith("Querying")).join(" | ") || "(no queries)"}`);
    for (const qr of message?.queries ?? []) {
      console.log(`   query: ${qr.tool} ${qr.db}.${qr.collection} -> ${qr.error ? `ERROR ${qr.error}` : `${qr.rowCount} rows`} (${qr.durationMs}ms)`);
      console.log(`          ${qr.query.replace(/\s+/g, " ").slice(0, 220)}`);
    }
    console.log(`   visual: ${message?.visualType}${message?.tableData?.rows ? ` table ${message.tableData.rows.length}x${message.tableData.columns.length} [${message.tableData.columns.join(", ")}]` : ""}${message?.chartData?.series?.length ? ` chart ${message.chartData.series.length} points` : ""}`);
    console.log(`   answer: ${(message?.content ?? "").replace(/\s+/g, " ").slice(0, 400)}`);
    const answer = message?.content ?? "";
    check("model answered", !!answer && !/unable to process|reached their daily limits|Error communicating/i.test(answer));
    const failed = (message?.queries ?? []).filter((x) => x.error);
    if (failed.length) console.log(`   note: ${failed.length} query error(s) returned to the model`);
    const text = JSON.stringify(message ?? {});
    check("no hidden values leaked", !/"password"\s*:\s*"[^"]/.test(text) && !/"jwt"\s*:\s*"[^"]/.test(text));
  }

  // 7. Per-chat bridge selection endpoint
  const chat = await api("/chats", { method: "POST", body: JSON.stringify({ title: "scoped" }) });
  const patched = await api(`/chats/${chat.body._id}`, { method: "PATCH", body: JSON.stringify({ bridgeIds: [id] }) });
  check("chat bridge selection saved", patched.status === 200 && patched.body.bridgeIds?.[0] === id);

  // 8. Cleanup
  const del = await api(`/connections/${id}`, { method: "DELETE" });
  check("bridge deleted", del.status === 200);

  console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
