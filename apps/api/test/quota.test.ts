import "./support/env";
import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { env } from "../src/config/env";
import { reserveQuota, settleQuota } from "../src/services/quota";
import { validateRequestedModel, serverModelRotation } from "../src/services/llmCredentials";
import { recordUsage, getUsage, utcDay } from "../src/services/usage";
import { HttpError } from "../src/lib/httpError";
import { clearDb, models, startDb, stopDb } from "./support/usersHarness";

const { User, UsageDaily } = models as any;

before(startDb);
after(stopDb);
beforeEach(clearDb);

const usageOf = async (id: unknown) => (await User.findById(id).lean()).freeTierUsage;

describe("reserveQuota / settleQuota", () => {
  test("10 concurrent reservations against a limit of 3: exactly 3 succeed", async () => {
    const user = await User.create({ email: "race@example.com", freeTierUsage: 0, freeTierLimit: 3 });
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => reserveQuota(user, 1)));
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    assert.equal(ok.length, 3);
    assert.equal(failed.length, 7);
    for (const f of failed) {
      assert.ok(f.reason instanceof HttpError);
      assert.equal(f.reason.code, "FREE_LIMIT_REACHED");
      assert.equal(f.reason.status, 429);
    }
    assert.equal(await usageOf(user._id), 3);
  });

  test("a multi-message cost only fits when the whole cost fits", async () => {
    const user = await User.create({ email: "cost@example.com", freeTierUsage: 1, freeTierLimit: 3 });
    await assert.rejects(reserveQuota(user, 3), (e: any) => e.code === "FREE_LIMIT_REACHED");
    assert.equal(await usageOf(user._id), 1);
    await reserveQuota(user, 2);
    assert.equal(await usageOf(user._id), 3);
  });

  test("settle refunds when nothing was produced, once", async () => {
    const user = await User.create({ email: "refund@example.com", freeTierUsage: 0, freeTierLimit: 5 });
    const r = await reserveQuota(user, 2);
    assert.equal(await usageOf(user._id), 2);
    await settleQuota(r, false);
    assert.equal(await usageOf(user._id), 0);
    await settleQuota(r, false); // idempotent
    assert.equal(await usageOf(user._id), 0);

    const kept = await reserveQuota(user, 1);
    await settleQuota(kept, true);
    assert.equal(await usageOf(user._id), 1);
  });

  test("BYOK users are not charged; demo users always are", async () => {
    const byok = await User.create({ email: "byok@example.com", customApiKeyEnc: "v1.x.y.z.w", freeTierUsage: 3, freeTierLimit: 3 });
    const r = await reserveQuota(byok, 1);
    assert.equal(r.charged, false);
    assert.equal(await usageOf(byok._id), 3);

    const legacy = await User.create({ email: "legacy@example.com", customApiKey: "AIzaPlaintextKey123456", freeTierUsage: 3, freeTierLimit: 3 });
    assert.equal((await reserveQuota(legacy, 1)).charged, false);

    const demo = await User.create({ email: "d@demo.wuup.in", isDemo: true, customApiKeyEnc: "v1.x.y.z.w", freeTierUsage: 0, freeTierLimit: 1 });
    assert.equal((await reserveQuota(demo, 1)).charged, true);
    await assert.rejects(reserveQuota(demo, 1), (e: any) => e.code === "FREE_LIMIT_REACHED");
  });
});

describe("validateRequestedModel", () => {
  test("auto, legacy Auto-Rotate and undefined map to auto", () => {
    const u = { freeTierUsage: 0 };
    assert.equal(validateRequestedModel(u), "auto");
    assert.equal(validateRequestedModel(u, "auto"), "auto");
    assert.equal(validateRequestedModel(u, "Auto-Rotate"), "auto");
  });

  test("server-key users are limited to the rotation plus SERVER_MODEL_ALLOWLIST", () => {
    const u = {};
    const rotation = serverModelRotation();
    assert.ok(rotation.length > 0);
    assert.equal(validateRequestedModel(u, rotation[0]), rotation[0]);
    assert.throws(() => validateRequestedModel(u, "gpt-4o"), (e: any) => e.status === 400 && e.code === "MODEL_UNAVAILABLE");
    const saved = env.SERVER_MODEL_ALLOWLIST;
    env.SERVER_MODEL_ALLOWLIST = ["gemini-2.5-pro"];
    try {
      assert.equal(validateRequestedModel(u, "gemini-2.5-pro"), "gemini-2.5-pro");
    } finally {
      env.SERVER_MODEL_ALLOWLIST = saved;
    }
  });

  test("BYOK users may pick any well-formed id", () => {
    const u = { customApiKeyEnc: "v1.x" };
    assert.equal(validateRequestedModel(u, "anthropic/claude-sonnet-4.5:beta"), "anthropic/claude-sonnet-4.5:beta");
    assert.throws(() => validateRequestedModel(u, "bad id with spaces"), (e: any) => e.code === "MODEL_UNAVAILABLE");
    assert.throws(() => validateRequestedModel(u, "x".repeat(101)), (e: any) => e.code === "MODEL_UNAVAILABLE");
  });
});

describe("usage recording", () => {
  test("recordUsage upserts one row per UTC day, concurrently", async () => {
    const user = await User.create({ email: "usage@example.com" });
    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        recordUsage(user._id, { mode: i === 0 ? "research" : "chat", tokensIn: 10, tokensOut: 20, provider: "gemini" })
      )
    );
    const rows = await UsageDaily.find({ userId: user._id }).lean();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].day, utcDay());
    assert.equal(rows[0].messages, 4);
    assert.equal(rows[0].research, 1);
    assert.equal(rows[0].tokensIn, 50);
    assert.equal(rows[0].tokensOut, 100);
    assert.equal(rows[0].byProvider.gemini.messages, 5);

    const { daily, totals } = await getUsage(user, 3);
    assert.equal(daily.length, 3);
    assert.deepEqual(daily.slice(0, 2).map((d) => d.messages), [0, 0]);
    assert.equal(daily[2].date, utcDay());
    assert.equal(totals.messages, 4);
  });
});
