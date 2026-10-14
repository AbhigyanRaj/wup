import "./support/env";
import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { DemoResponseSchema } from "@wup/contracts";
import { cryptoService } from "@wup/brain";
import { env } from "../src/config/env";
import { runUserSweepOnce } from "../src/jobs/sweepers";
import { ORIGIN, bearer, buildApp, clearDb, models, mongoose, request, sessionCookie, startDb, stopDb } from "./support/usersHarness";

const { User, Chat, Connection, UsageDaily, Message } = models as any;
const app = buildApp();
const silent = { info() {}, warn() {}, error() {} };

before(startDb);
after(stopDb);
beforeEach(async () => {
  await clearDb();
  env.DEMO_ENABLED = true;
  env.DEMO_MAX_ACTIVE = 500;
});

async function startDemo() {
  const res = await request(app).post("/auth/demo").set("Origin", ORIGIN).send({});
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return { res, token: res.body.token as string, id: res.body.user.id as string };
}

describe("POST /auth/demo", () => {
  test("creates a demo user and returns DemoResponse, cookie and token", async () => {
    const before = Date.now();
    const { res, id } = await startDemo();
    assert.ok(DemoResponseSchema.safeParse(res.body).success, JSON.stringify(res.body));
    assert.ok(sessionCookie(res));
    assert.equal(res.body.user.isDemo, true);
    assert.equal(res.body.user.name, "Guest");
    assert.equal(res.body.user.plan.tier, "demo");
    assert.equal(res.body.user.plan.freeTierLimit, env.DEMO_MESSAGE_LIMIT);
    // No Gemini key / sample URI in tests, so nothing is seeded
    assert.equal(res.body.demo.seededKnowledge, false);
    assert.equal(res.body.demo.seededBridge, false);

    const doc = await User.findById(id).lean();
    assert.match(doc.email, /^demo-[0-9a-f-]{36}@demo\.wuup\.in$/);
    assert.equal(doc.password, null);
    const ttl = doc.demoExpiresAt.getTime() - before;
    assert.ok(Math.abs(ttl - env.DEMO_TTL_HOURS * 3600_000) < 60_000);
    assert.equal(doc.purgeAt.getTime() - doc.demoExpiresAt.getTime(), 7 * 24 * 3600_000);
  });

  test("two demos are isolated from each other", async () => {
    const a = await startDemo();
    const b = await startDemo();
    assert.notEqual(a.id, b.id);
    assert.notEqual(a.res.body.user.email, b.res.body.user.email);

    await Chat.collection.insertOne({ userId: new mongoose.Types.ObjectId(a.id), title: "A's secret chat", createdAt: new Date() });

    const usageA = await request(app).get("/user/usage").set(bearer(a.token));
    const usageB = await request(app).get("/user/usage").set(bearer(b.token));
    assert.equal(usageA.body.counts.chats, 1);
    assert.equal(usageB.body.counts.chats, 0);

    const exportB = await request(app).get("/user/export").set(bearer(b.token));
    assert.equal(exportB.status, 200);
    assert.doesNotMatch(exportB.text, /A's secret chat/);
    assert.equal(JSON.parse(exportB.text).profile.id, b.id);
  });

  test("a seeded system bridge never exposes its config", async () => {
    const a = await startDemo();
    const uri = "mongodb+srv://sample:topsecret@sample.example.net/sample_mflix";
    const enc = cryptoService.encrypt(uri);
    await Connection.create({ userId: a.id, name: "Sample movies", type: "mongodb", config: enc, isSystem: true });

    const exp = await request(app).get("/user/export").set(bearer(a.token));
    assert.equal(exp.status, 200);
    assert.doesNotMatch(exp.text, /topsecret/);
    assert.ok(!exp.text.includes(enc));
    const body = JSON.parse(exp.text);
    assert.equal(body.connections.length, 1);
    assert.equal(body.connections[0].config, undefined);
    assert.equal(body.connections[0].isSystem, true);
  });

  test("demo users get 403 on PUT /user/api-key", async () => {
    const a = await startDemo();
    const res = await request(app).put("/user/api-key").set(bearer(a.token)).send({ apiKey: "AIzaSyDemoKey1234567890", provider: "gemini" });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, "FORBIDDEN");
  });

  test("an expired demo gets 401 DEMO_EXPIRED", async () => {
    const a = await startDemo();
    await User.updateOne({ _id: a.id }, { $set: { demoExpiresAt: new Date(Date.now() - 1000) } });
    const res = await request(app).get("/auth/me").set(bearer(a.token));
    assert.equal(res.status, 401);
    assert.equal(res.body.code, "DEMO_EXPIRED");
  });

  test("503 DEMO_UNAVAILABLE when disabled or at capacity", async () => {
    env.DEMO_ENABLED = false;
    const off = await request(app).post("/auth/demo").send({});
    assert.equal(off.status, 503);
    assert.equal(off.body.code, "DEMO_UNAVAILABLE");

    env.DEMO_ENABLED = true;
    env.DEMO_MAX_ACTIVE = 1;
    await startDemo();
    const full = await request(app).post("/auth/demo").send({});
    assert.equal(full.status, 503);
    assert.equal(full.body.code, "DEMO_UNAVAILABLE");
    assert.equal(await User.countDocuments({ isDemo: true }), 1);
  });

  test("a demo account can delete itself without a password", async () => {
    const a = await startDemo();
    const res = await request(app).delete("/user").set(bearer(a.token)).send({ confirm: "DELETE" });
    assert.equal(res.status, 204);
    assert.equal(await User.countDocuments({ _id: a.id }), 0);
  });
});

describe("user sweepers", () => {
  test("purge expired demos with everything they own, and keep live ones", async () => {
    const expired = await startDemo();
    const live = await startDemo();
    const oid = (id: string) => new mongoose.Types.ObjectId(id);
    for (const d of [expired, live]) {
      await Chat.collection.insertOne({ userId: oid(d.id), title: "t", createdAt: new Date() });
      await Message.collection.insertOne({ userId: oid(d.id), chatId: oid(d.id), content: "hi" });
      await UsageDaily.collection.insertOne({ userId: oid(d.id), day: "2026-01-01", messages: 1 });
    }
    await User.updateOne({ _id: expired.id }, { $set: { demoExpiresAt: new Date(Date.now() - 60_000) } });

    const r = await runUserSweepOnce(silent);
    assert.equal(r.demosPurged, 1);
    assert.equal(await User.countDocuments({ _id: expired.id }), 0);
    assert.equal(await Chat.countDocuments({ userId: expired.id }), 0);
    assert.equal(await Message.countDocuments({ userId: expired.id }), 0);
    assert.equal(await UsageDaily.countDocuments({ userId: expired.id }), 0);

    assert.equal(await User.countDocuments({ _id: live.id }), 1);
    assert.equal(await Chat.countDocuments({ userId: live.id }), 1);
  });

  test("resume deletions that stalled more than 10 minutes ago, leave fresh ones", async () => {
    const stale = await User.create({ email: "stale@example.com", deletingAt: new Date(Date.now() - 11 * 60_000) });
    const fresh = await User.create({ email: "fresh@example.com", deletingAt: new Date() });
    await Chat.collection.insertOne({ userId: stale._id, title: "t", createdAt: new Date() });

    const r = await runUserSweepOnce(silent);
    assert.equal(r.deletionsResumed, 1);
    assert.equal(await User.countDocuments({ _id: stale._id }), 0);
    assert.equal(await Chat.countDocuments({ userId: stale._id }), 0);
    assert.equal(await User.countDocuments({ _id: fresh._id }), 1);
  });
});
