import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_COOLDOWN_MS, MAX_COOLDOWN_MS, ModelHealth, nextQuotaReset } from "../src/ai/modelHealth";

const retry = (s: string) => ({ errorDetails: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: s }] });
const daily = { errorDetails: [{ "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" }] }] };

function clock(start: number) {
  let now = start;
  return { now: () => now, advance: (ms: number) => (now += ms) };
}

describe("ModelHealth", () => {
  test("per-minute limits expire after retryDelay", () => {
    const c = clock(Date.UTC(2026, 9, 14, 12));
    const h = new ModelHealth(c.now);
    h.markExhausted("server", "gemini-2.5-flash", retry("30s"));
    assert.equal(h.isAvailable("server", "gemini-2.5-flash"), false);
    assert.deepEqual(h.exhausted("server"), ["gemini-2.5-flash"]);
    c.advance(29_000);
    assert.equal(h.isAvailable("server", "gemini-2.5-flash"), false);
    c.advance(1_000);
    assert.equal(h.isAvailable("server", "gemini-2.5-flash"), true);
    assert.deepEqual(h.exhausted("server"), []);
  });

  test("defaults to 60s and caps hints at 5 minutes", () => {
    const c = clock(Date.UTC(2026, 9, 14, 12));
    const h = new ModelHealth(c.now);
    assert.equal(h.markExhausted("k", "a"), c.now() + DEFAULT_COOLDOWN_MS);
    assert.equal(h.markExhausted("k", "b", retry("3600s")), c.now() + MAX_COOLDOWN_MS);
  });

  test("daily quota cools down until the next midnight in Los Angeles", () => {
    // 2026-10-14 13:00 PDT (UTC-7)
    const c = clock(Date.UTC(2026, 9, 14, 20));
    const h = new ModelHealth(c.now);
    const until = h.markExhausted("server", "gemini-2.5-flash", daily);
    assert.equal(new Date(until).toISOString(), "2026-10-15T07:00:00.000Z");
    c.advance(until - c.now() - 1);
    assert.equal(h.isAvailable("server", "gemini-2.5-flash"), false);
    c.advance(1);
    assert.equal(h.isAvailable("server", "gemini-2.5-flash"), true);
  });

  test("next quota reset handles both sides of a DST change", () => {
    // DST ends 2026-11-01 02:00 local. Midnight of Nov 1 is still PDT.
    assert.equal(new Date(nextQuotaReset(Date.UTC(2026, 9, 31, 20))).toISOString(), "2026-11-01T07:00:00.000Z");
    // After the change, midnight Nov 2 is PST (UTC-8).
    assert.equal(new Date(nextQuotaReset(Date.UTC(2026, 10, 1, 20))).toISOString(), "2026-11-02T08:00:00.000Z");
    // Just before local midnight.
    assert.equal(new Date(nextQuotaReset(Date.UTC(2026, 9, 15, 6, 59))).toISOString(), "2026-10-15T07:00:00.000Z");
  });

  test("keys are isolated", () => {
    const h = new ModelHealth();
    h.markExhausted("userA", "gemini-2.5-flash", retry("60s"));
    assert.equal(h.isAvailable("userA", "gemini-2.5-flash"), false);
    assert.equal(h.isAvailable("userB", "gemini-2.5-flash"), true);
    assert.equal(h.isAvailable("server", "gemini-2.5-flash"), true);
    assert.deepEqual(h.exhausted("userB"), []);
    assert.equal(h.cooldownUntil("userB", "gemini-2.5-flash"), null);
    assert.ok(h.cooldownUntil("userA", "gemini-2.5-flash")! > Date.now());
  });
});
