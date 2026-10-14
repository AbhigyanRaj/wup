import "./support/env";
import { test, describe, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { ModelsResponseSchema, UsageResponseSchema, AuthResponseSchema } from "@wup/contracts";
import { cryptoService } from "@wup/brain";
import { resolveLlmCredentials } from "../src/services/llmCredentials";
import { recordUsage, utcDay } from "../src/services/usage";
import { deleteUserCascade } from "../src/services/deleteUser";
import migration002 from "../src/migrations/002-encrypt-byok";
import migration003 from "../src/migrations/003-lowercase-emails";
import migration007 from "../src/migrations/007-sync-indexes";
import { ORIGIN, bearer, buildApp, clearDb, models, mongoose, request, signup, startDb, stopDb } from "./support/usersHarness";

const { User, Chat, Message, Connection, KnowledgeChunk, KnowledgeSource, KnowledgeSourceText, UsageDaily } = models as any;
const app = buildApp();
const silent = { log: { info() {}, warn() {}, error() {} } };
const rawUser = (id: unknown) => mongoose.connection.db!.collection("users").findOne({ _id: new mongoose.Types.ObjectId(String(id)) });

const GEMINI_KEY = "AIzaSyTESTKEY_abcdefghijklmnop_wxyz";

type FetchCall = { url: string; init?: RequestInit };
let calls: FetchCall[] = [];
const realFetch = globalThis.fetch;

function mockFetch(handler: (url: string, init?: RequestInit) => { status: number; body: unknown }) {
  calls = [];
  globalThis.fetch = (async (input: any, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const { status, body } = handler(url, init);
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
}

before(startDb);
after(stopDb);
beforeEach(clearDb);
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("PUT /user/api-key", () => {
  test("stores the key encrypted (no plaintext in the raw document) and keeps legacy response fields", async () => {
    mockFetch((url) =>
      url.includes(":generateContent")
        ? { status: 200, body: { candidates: [] } }
        : {
            status: 200,
            body: {
              models: [
                { name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] },
                { name: "models/text-embedding-004", supportedGenerationMethods: ["embedContent"] },
              ],
            },
          }
    );
    const u = await signup(app);
    const res = await request(app).put("/user/api-key").set(bearer(u.token)).send({ apiKey: GEMINI_KEY });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.success, true);
    assert.equal(res.body.provider, "gemini");
    assert.equal(res.body.maskedKey, "AIza••••wxyz");
    assert.deepEqual(res.body.availableModels, ["gemini-2.5-flash"]);

    // The key travels in a header, never in the URL
    assert.ok(calls.length >= 1);
    for (const c of calls) {
      assert.ok(!c.url.includes(GEMINI_KEY), "key must not be in the URL");
      assert.equal((c.init?.headers as any)?.["x-goog-api-key"], GEMINI_KEY);
      assert.ok(c.init?.signal, "fetch must have a timeout signal");
    }

    const doc = await rawUser(u.id);
    assert.ok(!("customApiKey" in doc!) || doc!.customApiKey === "", "no plaintext key stored");
    assert.ok(!JSON.stringify(doc).includes(GEMINI_KEY));
    assert.equal(cryptoService.decrypt(doc!.customApiKeyEnc), GEMINI_KEY);
    assert.equal(doc!.customApiKeyHint, "AIza••••wxyz");
    assert.equal(doc!.customApiProvider, "gemini");

    const usage = await request(app).get("/user/usage").set(bearer(u.token));
    assert.equal(usage.body.hasCustomKey, true);
    assert.equal(usage.body.maskedKey, "AIza••••wxyz");
    assert.equal(usage.body.provider, "gemini");
    assert.equal(usage.body.plan.tier, "byok");
    assert.equal(usage.body.plan.limit, null);
    assert.deepEqual(usage.body.apiKey, { provider: "gemini", maskedKey: "AIza••••wxyz" });

    const creds = await resolveLlmCredentials(await User.findById(u.id));
    assert.equal(creds.apiKey, GEMINI_KEY);
    assert.equal(creds.provider, "gemini");
    assert.match(creds.keyId, /^[0-9a-f]{12}$/);
  });

  test("an invalid key is a 400 with an error message and stores nothing", async () => {
    mockFetch(() => ({ status: 400, body: { error: { message: "API key not valid" } } }));
    const u = await signup(app);
    const res = await request(app).put("/user/api-key").set(bearer(u.token)).send({ apiKey: GEMINI_KEY, provider: "gemini" });
    assert.equal(res.status, 400);
    assert.equal(typeof res.body.error, "string");
    const doc = await rawUser(u.id);
    assert.equal(doc!.customApiKeyEnc, undefined);
  });

  test("Google region block gets a generic region message", async () => {
    mockFetch((url) =>
      url.includes(":generateContent")
        ? { status: 400, body: { error: { message: "User location is not supported for the API use." } } }
        : { status: 200, body: { models: [] } }
    );
    const u = await signup(app);
    const res = await request(app).put("/user/api-key").set(bearer(u.token)).send({ apiKey: GEMINI_KEY });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /region/);
    assert.doesNotMatch(res.body.error, /Singapore/);
  });

  test("DELETE /user/api-key is 204 and removes every key field", async () => {
    const u = await signup(app);
    await User.updateOne({ _id: u.id }, { $set: { customApiKeyEnc: cryptoService.encrypt(GEMINI_KEY), customApiKeyHint: "x", customApiProvider: "openai" } });
    const res = await request(app).delete("/user/api-key").set(bearer(u.token));
    assert.equal(res.status, 204);
    const doc = await rawUser(u.id);
    assert.equal(doc!.customApiKeyEnc, undefined);
    assert.equal(doc!.customApiKeyHint, undefined);
    const usage = await request(app).get("/user/usage").set(bearer(u.token));
    assert.equal(usage.body.hasCustomKey, false);
    assert.equal(usage.body.apiKey, null);
  });
});

describe("legacy plaintext keys", () => {
  test("resolveLlmCredentials migrates a plaintext key lazily", async () => {
    const user = await User.create({ email: "lazy@example.com", customApiKey: "sk-legacy-plaintext-key-1234", customApiProvider: "openai" });
    const creds = await resolveLlmCredentials(user);
    assert.equal(creds.apiKey, "sk-legacy-plaintext-key-1234");
    assert.equal(creds.provider, "openai");

    const doc = await rawUser(user._id);
    assert.ok(!("customApiKey" in doc!));
    assert.equal(cryptoService.decrypt(doc!.customApiKeyEnc), "sk-legacy-plaintext-key-1234");
    assert.equal(doc!.customApiKeyHint, "sk-l••••1234");

    // Next resolve uses the encrypted copy
    const again = await resolveLlmCredentials(await User.findById(user._id));
    assert.equal(again.apiKey, "sk-legacy-plaintext-key-1234");
    assert.equal(again.keyId, creds.keyId);
  });

  test("no key resolves to the server credentials", async () => {
    const user = await User.create({ email: "free@example.com" });
    assert.deepEqual(await resolveLlmCredentials(user), { provider: "gemini", apiKey: null, keyId: "server" });
  });

  test("migration 002 encrypts every plaintext key and is idempotent", async () => {
    const users = await User.collection.insertMany([
      { email: "m1@example.com", customApiKey: "AIzaPlainKeyNumberOne_0001" },
      { email: "m2@example.com", customApiKey: "sk-ant-plain-key-number-two" },
      { email: "m3@example.com", customApiKey: "" },
      { email: "m4@example.com" },
    ]);
    await migration002.up(silent);
    const ids = Object.values(users.insertedIds);
    const [m1, m2, m3, m4] = await Promise.all(ids.map((id) => rawUser(id)));
    assert.ok(!("customApiKey" in m1!));
    assert.equal(cryptoService.decrypt(m1!.customApiKeyEnc), "AIzaPlainKeyNumberOne_0001");
    assert.equal(cryptoService.decrypt(m2!.customApiKeyEnc), "sk-ant-plain-key-number-two");
    assert.equal(m3!.customApiKeyEnc, undefined);
    assert.equal(m4!.customApiKeyEnc, undefined);

    const enc1 = m1!.customApiKeyEnc;
    await migration002.up(silent);
    assert.equal((await rawUser(ids[0]))!.customApiKeyEnc, enc1, "second run changes nothing");
  });
});

describe("migrations 003 and 007", () => {
  test("003 lowercases emails, skips case collisions without merging, and is idempotent", async () => {
    await User.collection.insertMany([
      { email: "Alice@Example.com" },
      { email: "BOB@example.com" },
      { email: "bob@example.com" },
      { email: "  Carol@Example.com " },
    ]);
    await migration003.up(silent);
    await migration003.up(silent);
    const emails = (await User.collection.find({}).toArray()).map((d: any) => d.email).sort();
    assert.deepEqual(emails, ["BOB@example.com", "alice@example.com", "bob@example.com", "carol@example.com"]);
  });

  test("007 syncs indexes without throwing (twice)", async () => {
    await migration007.up(silent);
    await migration007.up(silent);
    const idx = await mongoose.connection.db!.collection("users").indexes();
    assert.ok(idx.some((i: any) => i.key.purgeAt === 1 && i.expireAfterSeconds === 0));
    const textIdx = (await mongoose.connection.db!.collection("messages").indexes()).filter((i: any) => i.key._fts === "text");
    assert.equal(textIdx.length, 1);
  });
});

describe("profile and preferences", () => {
  test("PATCH /user/profile returns AuthResponse", async () => {
    const u = await signup(app);
    const res = await request(app).patch("/user/profile").set(bearer(u.token)).send({ name: "  Ada  " });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.name, "Ada");
    assert.ok(AuthResponseSchema.safeParse(res.body).success);
  });

  test("PATCH /user/preferences updates fields, sets onboarding dates and enforces caps", async () => {
    const u = await signup(app);
    const ok = await request(app)
      .patch("/user/preferences")
      .set("Origin", ORIGIN)
      .set("Cookie", u.cookie)
      .send({ aboutMe: "I run a bakery", responseStyle: "concise", preferTables: true, onboarding: { welcomeSeen: true } });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.user.preferences.aboutMe, "I run a bakery");
    assert.equal(ok.body.user.preferences.responseStyle, "concise");
    assert.equal(ok.body.user.preferences.preferTables, true);
    assert.equal(ok.body.user.preferences.customInstructions, "");
    assert.ok(ok.body.user.onboarding.welcomeSeenAt);
    assert.equal(ok.body.user.onboarding.checklistDismissedAt, null);

    const tooLong = await request(app).patch("/user/preferences").set(bearer(u.token)).send({ aboutMe: "x".repeat(1501) });
    assert.equal(tooLong.status, 400);
    assert.equal(tooLong.body.code, "VALIDATION_FAILED");

    const badStyle = await request(app).patch("/user/preferences").set(bearer(u.token)).send({ responseStyle: "verbose" });
    assert.equal(badStyle.status, 400);

    const doc = await User.findById(u.id).lean();
    assert.equal(doc.preferences.aboutMe, "I run a bakery");
  });
});

describe("GET /user/usage and /user/models", () => {
  test("usage is zero-filled per UTC day, capped at 90 days, and keeps legacy fields", async () => {
    const u = await signup(app);
    await recordUsage(u.id, { mode: "chat", tokensIn: 5, tokensOut: 7 });
    const res = await request(app).get("/user/usage?days=7").set(bearer(u.token));
    assert.equal(res.status, 200);
    const parsed = UsageResponseSchema.safeParse(res.body);
    assert.ok(parsed.success, JSON.stringify(parsed.error?.issues));
    assert.equal(res.body.daily.length, 7);
    assert.equal(res.body.daily[6].date, utcDay());
    assert.equal(res.body.daily[6].messages, 1);
    assert.ok(res.body.daily.slice(0, 6).every((d: any) => d.messages === 0 && d.tokensIn === 0));
    assert.equal(res.body.totals.tokensOut, 7);
    assert.equal(res.body.plan.tier, "free");
    assert.equal(res.body.plan.remaining, res.body.plan.limit - res.body.plan.used);

    // Legacy fields the current web client reads
    for (const k of ["freeTierUsage", "freeTierLimit", "hasCustomKey", "availableModels"]) {
      assert.ok(k in res.body, `missing legacy field ${k}`);
    }
    assert.equal(res.body.hasCustomKey, false);

    const capped = await request(app).get("/user/usage?days=500").set(bearer(u.token));
    assert.equal(capped.body.daily.length, 90);
    const dflt = await request(app).get("/user/usage").set(bearer(u.token));
    assert.equal(dflt.body.daily.length, 30);
  });

  test("models: auto first; BYOK users see their stored models", async () => {
    const u = await signup(app);
    const free = await request(app).get("/user/models").set(bearer(u.token));
    assert.equal(free.status, 200);
    assert.ok(ModelsResponseSchema.safeParse(free.body).success, JSON.stringify(free.body));
    assert.equal(free.body.models[0].id, "auto");
    assert.equal(free.body.usingOwnKey, false);

    await User.updateOne(
      { _id: u.id },
      { $set: { customApiKeyEnc: cryptoService.encrypt("sk-test-openai-key-123456"), customApiProvider: "openai", availableModels: ["gpt-4o", "gpt-4o-mini"] } }
    );
    const byok = await request(app).get("/user/models").set(bearer(u.token));
    assert.equal(byok.body.provider, "openai");
    assert.equal(byok.body.usingOwnKey, true);
    assert.equal(byok.body.models[0].id, "auto");
    if (typeof (require("@wup/brain") as any).listModels !== "function") {
      assert.deepEqual(byok.body.models.map((m: any) => m.id), ["auto", "gpt-4o", "gpt-4o-mini"]);
    }
  });
});

describe("export and account deletion", () => {
  test("GET /user/export is a JSON attachment with no credentials", async () => {
    const u = await signup(app);
    await Connection.create({ userId: u.id, name: "Prod", type: "mongodb", config: cryptoService.encrypt("mongodb://user:pw@host/db") });
    const res = await request(app).get("/user/export").set(bearer(u.token));
    assert.equal(res.status, 200);
    assert.match(String(res.headers["content-disposition"]), /^attachment; filename="wuup-export-\d{4}-\d{2}-\d{2}\.json"$/);
    const body = JSON.parse(res.text);
    assert.equal(body.profile.id, u.id);
    assert.equal(body.connections[0].name, "Prod");
    assert.equal(body.connections[0].config, undefined);
    assert.doesNotMatch(res.text, /pw@host|password/);
  });

  test("DELETE /user cascades through every collection and leaves other users alone", async () => {
    const victim = await signup(app, "victim@example.com", "a strong secret 1");
    const bystander = await signup(app, "bystander@example.com", "a strong secret 2");
    const seed = async (id: string) => {
      const userId = new mongoose.Types.ObjectId(id);
      await Chat.collection.insertOne({ userId, title: "t" });
      await Message.collection.insertOne({ userId, chatId: userId, content: "hi" });
      await Connection.collection.insertOne({ userId, name: "c", type: "mongodb", config: "x" });
      await KnowledgeSource.collection.insertOne({ userId, name: "doc.pdf" });
      await KnowledgeSourceText.collection.insertOne({ userId, sourceId: userId, text: "..." });
      await KnowledgeChunk.collection.insertOne({ userId, sourceId: userId, text: "..." });
      await UsageDaily.collection.insertOne({ userId, day: "2026-01-01", messages: 1 });
    };
    await seed(victim.id);
    await seed(bystander.id);

    const noConfirm = await request(app).delete("/user").set(bearer(victim.token)).send({ password: "a strong secret 1" });
    assert.equal(noConfirm.status, 400);
    const wrongPw = await request(app).delete("/user").set(bearer(victim.token)).send({ password: "nope", confirm: "DELETE" });
    assert.equal(wrongPw.status, 400);
    const noPw = await request(app).delete("/user").set(bearer(victim.token)).send({ confirm: "DELETE" });
    assert.equal(noPw.status, 400);

    const res = await request(app)
      .delete("/user")
      .set("Origin", ORIGIN)
      .set("Cookie", victim.cookie)
      .send({ password: "a strong secret 1", confirm: "DELETE" });
    assert.equal(res.status, 204);
    assert.match(String(res.headers["set-cookie"]), /wuup_session=;/);

    for (const M of [Chat, Message, Connection, KnowledgeSource, KnowledgeSourceText, KnowledgeChunk, UsageDaily]) {
      assert.equal(await M.collection.countDocuments({ userId: new mongoose.Types.ObjectId(victim.id) }), 0, M.modelName);
      assert.equal(await M.collection.countDocuments({ userId: new mongoose.Types.ObjectId(bystander.id) }), 1, M.modelName);
    }
    assert.equal(await User.countDocuments({ _id: victim.id }), 0);
    assert.equal((await request(app).get("/auth/me").set(bearer(victim.token))).status, 401);

    // Idempotent: running the cascade again is harmless
    const again = await deleteUserCascade(victim.id);
    assert.equal(again.userDeleted, false);
  });
});
