import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  configureEmbedder,
  embed,
  embedBatch,
  EmbeddingQuotaError,
  EMBEDDING_DIMENSIONS,
  type EmbeddingClient,
} from "../src/embedder";

const vec = (seed: number) => Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => (seed + i) % 7);

class FakeClient implements EmbeddingClient {
  calls: Array<{ texts: string[]; apiKey?: string }> = [];
  failures: unknown[] = [];
  async embedTexts(texts: string[], opts: { apiKey?: string; signal?: AbortSignal }) {
    this.calls.push({ texts, apiKey: opts.apiKey });
    const f = this.failures.shift();
    if (f) throw f;
    return texts.map((_, i) => vec(i));
  }
}

function httpError(status: number, message: string, errorDetails?: unknown) {
  const e: any = new Error(`[${status} Too Many Requests] ${message}`);
  e.status = status;
  e.errorDetails = errorDetails;
  return e;
}

let restore: (() => void) | null = null;
afterEach(() => {
  restore?.();
  restore = null;
});

test("embedBatch sends batches of 50 and reports progress", async () => {
  const client = new FakeClient();
  restore = configureEmbedder({ client, backoffMs: [1] });
  const progress: Array<[number, number]> = [];
  const texts = Array.from({ length: 120 }, (_, i) => `t${i}`);
  const out = await embedBatch(texts, { apiKey: "user-key", onProgress: (d, t) => progress.push([d, t]) });
  assert.equal(out.length, 120);
  assert.deepEqual(client.calls.map((c) => c.texts.length), [50, 50, 20]);
  assert.equal(client.calls[2].texts[0], "t100");
  assert.ok(client.calls.every((c) => c.apiKey === "user-key"));
  assert.deepEqual(progress, [[50, 120], [100, 120], [120, 120]]);
});

test("legacy embedBatch(texts, onProgress) signature still works", async () => {
  const client = new FakeClient();
  restore = configureEmbedder({ client });
  let last = 0;
  await embedBatch(["a", "b"], (done) => (last = done));
  assert.equal(last, 2);
});

test("429 and 5xx are retried with backoff and honour retryDelay", async () => {
  const client = new FakeClient();
  restore = configureEmbedder({ client, backoffMs: [5, 5, 5, 5, 5] });
  client.failures.push(
    httpError(429, "Resource has been exhausted", [
      { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "0.08s" },
    ]),
    httpError(503, "unavailable")
  );
  const started = Date.now();
  const out = await embed("query");
  assert.equal(out.length, EMBEDDING_DIMENSIONS);
  assert.equal(client.calls.length, 3);
  assert.ok(Date.now() - started >= 75, "retryDelay was honoured");
});

test("gives up after the backoff schedule is exhausted", async () => {
  const client = new FakeClient();
  restore = configureEmbedder({ client, backoffMs: [1, 1] });
  client.failures.push(httpError(429, "a"), httpError(429, "b"), httpError(429, "c"), httpError(429, "d"));
  await assert.rejects(embed("q"), (e: any) => e.status === 429);
  assert.equal(client.calls.length, 3);
});

test("PerDay quota fails fast with error_quota", async () => {
  const client = new FakeClient();
  restore = configureEmbedder({ client, backoffMs: [1000, 1000] });
  client.failures.push(
    httpError(429, "Quota exceeded", [
      {
        "@type": "type.googleapis.com/google.rpc.QuotaFailure",
        violations: [{ quotaId: "EmbedContentRequestsPerDayPerProjectPerModel-FreeTier" }],
      },
    ])
  );
  const started = Date.now();
  await assert.rejects(embedBatch(["a"]), (e: any) => e instanceof EmbeddingQuotaError && e.code === "error_quota");
  assert.equal(client.calls.length, 1);
  assert.ok(Date.now() - started < 500);
});

test("non-retryable errors are not retried", async () => {
  const client = new FakeClient();
  restore = configureEmbedder({ client, backoffMs: [1, 1] });
  client.failures.push(httpError(400, "API key not valid"));
  await assert.rejects(embed("q"), /API key not valid/);
  assert.equal(client.calls.length, 1);
});

test("wrong dimensionality is an error", async () => {
  restore = configureEmbedder({
    client: { embedTexts: async (texts) => texts.map(() => [1, 2, 3]) },
    backoffMs: [1],
  });
  await assert.rejects(embed("q"), /768-dim/);
});

test("abort during a backoff wait rejects immediately", async () => {
  const client = new FakeClient();
  restore = configureEmbedder({ client, backoffMs: [10_000] });
  client.failures.push(httpError(429, "slow down"));
  const ac = new AbortController();
  setTimeout(() => ac.abort(), 20);
  const started = Date.now();
  await assert.rejects(embedBatch(["a"], { signal: ac.signal }), (e: any) => e.name === "AbortError");
  assert.ok(Date.now() - started < 2000);
  assert.equal(client.calls.length, 1);
});

test("an already-aborted signal makes no call", async () => {
  const client = new FakeClient();
  restore = configureEmbedder({ client });
  const ac = new AbortController();
  ac.abort();
  await assert.rejects(embed("q", { signal: ac.signal }));
  assert.equal(client.calls.length, 0);
});
