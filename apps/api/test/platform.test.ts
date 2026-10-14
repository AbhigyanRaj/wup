import { createTestApp, TEST_ORIGIN } from "./helpers/testApp";
import { useTestDb, startTestDb } from "./helpers/db";
import { createTestUser, bearer, legacyBearer, cookieAgent, sessionCookie, legacyTokenFor } from "./helpers/auth";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
import { z } from "zod";
import { Migration, User, Waitlist } from "@wup/models";
import { parseEnv, isAllowedOrigin, JWT_SECRET, EnvError } from "../src/config/env";
import { buildCors } from "../src/app";
import { authenticate } from "../src/middleware/auth";
import { validate } from "../src/middleware/validate";
import { objectIdParam } from "../src/lib/objectId";
import { HttpError } from "../src/lib/httpError";
import { asyncHandler } from "../src/lib/asyncHandler";
import { runMigrations, MIGRATIONS } from "../src/migrations";
import { sessionCookieName, TOKEN_ISSUER } from "../src/lib/session";

useTestDb();

const PROD_BASE = {
  NODE_ENV: "production",
  MONGODB_URI: "mongodb://db.example.com/wup",
  JWT_SECRET: "a".repeat(40),
  ENCRYPTION_KEY: "b".repeat(40),
  CORS_ORIGIN: "https://wuup.in",
};

/** App with a few extra routes for exercising platform middleware. */
function appWithTestRoutes() {
  return createTestApp({
    mount(app) {
      const r = express.Router();
      objectIdParam(r, "thingId");
      r.get("/boom", () => {
        throw new Error("secret internal detail");
      });
      r.get(
        "/boom-async",
        asyncHandler(async () => {
          throw new Error("async secret");
        })
      );
      r.get("/teapot", () => {
        throw new HttpError(409, "CONFLICT", "Already exists");
      });
      r.get("/me", authenticate, (req, res) => res.json({ auth: req.auth, user: req.user }));
      r.post("/me", authenticate, (req, res) => res.json({ ok: true, userId: req.auth?.userId }));
      r.post(
        "/validate",
        validate({ body: z.object({ n: z.coerce.number().int(), tag: z.string().default("x") }) }),
        (req, res) => res.json(req.body)
      );
      r.post(
        "/validate-legacy",
        validate(z.object({ body: z.object({ name: z.string().trim().min(1) }) })),
        (req, res) => res.json(req.body)
      );
      r.get(
        "/validate-query",
        validate({ query: z.object({ limit: z.coerce.number().max(50).default(20) }) }),
        (req, res) => res.json({ validated: req.validatedQuery })
      );
      r.get("/things/:thingId", (req, res) => res.json({ id: req.params.thingId }));
      app.use("/_t", r);
    },
  });
}

describe("headers, request id, CORS", () => {
  test("helmet headers and X-Request-Id", async () => {
    const { app } = createTestApp();
    const res = await request(app).get("/");
    assert.equal(res.status, 200);
    assert.deepEqual(Object.keys(res.body).sort(), ["name", "status", "version"]);
    assert.equal(res.body.name, "wuup-api");
    assert.equal(res.headers["x-content-type-options"], "nosniff");
    assert.equal(res.headers["cross-origin-resource-policy"], "same-site");
    assert.ok(res.headers["strict-transport-security"]);
    assert.equal(res.headers["x-powered-by"], undefined);
    assert.match(res.headers["x-request-id"], /^[0-9a-f-]{36}$/);

    const echoed = await request(app).get("/").set("X-Request-Id", "abc-123");
    assert.equal(echoed.headers["x-request-id"], "abc-123");
    const bad = await request(app).get("/").set("X-Request-Id", "bad id <script>");
    assert.notEqual(bad.headers["x-request-id"], "bad id <script>");
  });

  test("CORS allows listed origins with credentials and ignores others", async () => {
    const { app } = createTestApp();
    const ok = await request(app).get("/").set("Origin", TEST_ORIGIN);
    assert.equal(ok.headers["access-control-allow-origin"], TEST_ORIGIN);
    assert.equal(ok.headers["access-control-allow-credentials"], "true");
    const evil = await request(app).get("/").set("Origin", "https://evil.example");
    assert.equal(evil.status, 200);
    assert.equal(evil.headers["access-control-allow-origin"], undefined);
  });

  test("production CORS drops and rejects localhost", async () => {
    const { env: prodEnv, warnings } = parseEnv({ ...PROD_BASE, CORS_ORIGIN: "https://wuup.in/, http://localhost:3000" });
    assert.deepEqual(prodEnv.CORS_ORIGINS, ["https://wuup.in"]);
    assert.ok(warnings.some((w) => w.includes("localhost")));
    assert.equal(isAllowedOrigin("http://localhost:3000", prodEnv), false);
    assert.equal(isAllowedOrigin("https://wuup.in", prodEnv), true);

    const app = express();
    app.use(buildCors(prodEnv));
    app.get("/", (_req, res) => res.json({ ok: true }));
    const local = await request(app).get("/").set("Origin", "http://localhost:3000");
    assert.equal(local.headers["access-control-allow-origin"], undefined);
    const site = await request(app).get("/").set("Origin", "https://wuup.in");
    assert.equal(site.headers["access-control-allow-origin"], "https://wuup.in");
  });
});

describe("env validation", () => {
  test("production fail-fast rules", () => {
    assert.throws(() => parseEnv({ ...PROD_BASE, JWT_SECRET: undefined }), EnvError);
    assert.throws(() => parseEnv({ ...PROD_BASE, JWT_SECRET: "wup_super_secret_brain_key_2026" }), /JWT_SECRET/);
    assert.throws(
      () => parseEnv({ ...PROD_BASE, ENCRYPTION_KEY: "wup_internal_default_secret_2026_do_not_use_in_prod" }),
      /ENCRYPTION_KEY/
    );
    assert.throws(() => parseEnv({ ...PROD_BASE, MONGODB_URI: "" }), /MONGODB_URI/);
    assert.throws(() => parseEnv({ ...PROD_BASE, CORS_ORIGIN: undefined }), /CORS_ORIGIN/);
    assert.throws(() => parseEnv({ ...PROD_BASE, BRIDGE_ALLOW_PRIVATE_HOSTS: "true" }), /BRIDGE_ALLOW_PRIVATE_HOSTS/);

    // A short but real secret only warns, so an existing deploy keeps booting
    const short = parseEnv({ ...PROD_BASE, JWT_SECRET: "short-but-real" });
    assert.equal(short.env.JWT_SECRET, "short-but-real");
    assert.ok(short.warnings.some((w) => w.includes("JWT_SECRET")));
  });

  test("defaults and soft parsing", () => {
    const { env: e, warnings } = parseEnv({ PORT: "abc", RAG_MIN_COSINE: "0.7", DEMO_ENABLED: "false" });
    assert.equal(e.PORT, 4000);
    assert.ok(warnings.some((w) => w.startsWith("PORT")));
    assert.equal(e.RAG_MIN_COSINE, 0.7);
    assert.equal(e.DEMO_ENABLED, false);
    assert.equal(e.FREE_TIER_LIMIT, 50);
    assert.equal(e.TRUST_PROXY, 1);
    assert.equal(e.SESSION_TTL_DAYS, 7);
    assert.equal(e.IS_PRODUCTION, false);
    assert.equal(e.JWT_SECRET, "wup_super_secret_brain_key_2026");
  });
});

describe("error handling", () => {
  test("invalid JSON -> 400", async () => {
    const { app } = createTestApp();
    const res = await request(app).post("/auth/login").set("Content-Type", "application/json").send('{"email": ');
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "VALIDATION_FAILED");
    assert.equal(res.body.error, "Invalid JSON body");
    assert.ok(res.body.requestId);
  });

  test("oversize body -> 413", async () => {
    const { app } = createTestApp();
    const res = await request(app)
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ email: "a@b.co", password: "x".repeat(1_100_000) }));
    assert.equal(res.status, 413);
    assert.equal(res.body.code, "PAYLOAD_TOO_LARGE");
  });

  test("unknown route -> 404 JSON", async () => {
    const { app } = createTestApp();
    const res = await request(app).get("/definitely/not/here");
    assert.equal(res.status, 404);
    assert.equal(res.body.code, "NOT_FOUND");
    assert.ok(res.body.requestId);
  });

  test("thrown errors -> generic 500 with requestId, no internals", async () => {
    const { app } = appWithTestRoutes();
    for (const path of ["/_t/boom", "/_t/boom-async"]) {
      const res = await request(app).get(path).set("X-Request-Id", "req-500");
      assert.equal(res.status, 500);
      assert.deepEqual(res.body, { error: "Internal Server Error", code: "INTERNAL", requestId: "req-500" });
      assert.ok(!res.text.includes("secret"));
    }
  });

  test("HttpError keeps its status and code", async () => {
    const { app } = appWithTestRoutes();
    const res = await request(app).get("/_t/teapot");
    assert.equal(res.status, 409);
    assert.equal(res.body.code, "CONFLICT");
    assert.equal(res.body.error, "Already exists");
  });
});

describe("rejectOperators", () => {
  test("$ keys in body or query -> 400", async () => {
    const { app } = createTestApp();
    const body = await request(app).post("/auth/login").send({ email: { $gt: "" }, password: "x" });
    assert.equal(body.status, 400);
    assert.equal(body.body.code, "VALIDATION_FAILED");

    const nested = await request(app).post("/auth/login").send({ email: "a@b.co", meta: [{ deep: { $where: "1" } }] });
    assert.equal(nested.status, 400);

    const query = await request(app).get("/meta?filter[$ne]=1");
    assert.equal(query.status, 400);
  });

  test("$ inside string values is fine; excluded routes are not checked", async () => {
    const { app } = appWithTestRoutes();
    const ok = await request(app).post("/_t/validate").send({ n: 1, tag: "$100 price" });
    assert.equal(ok.status, 200);
    // /connections is excluded: the request reaches auth (401), not the operator check (400)
    const conn = await request(app).post("/connections").send({ config: { $x: 1 } });
    assert.equal(conn.status, 401);
  });
});

describe("validate and objectIdParam", () => {
  test("parsed output is written back", async () => {
    const { app } = appWithTestRoutes();
    const res = await request(app).post("/_t/validate").send({ n: "42" });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { n: 42, tag: "x" });

    const bad = await request(app).post("/_t/validate").send({ n: "nope" });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.code, "VALIDATION_FAILED");
    assert.equal(bad.body.error, "Validation failed");
    assert.equal(bad.body.details[0].path, "n");

    const legacy = await request(app).post("/_t/validate-legacy").send({ name: "  hi  " });
    assert.deepEqual(legacy.body, { name: "hi" });
    const legacyBad = await request(app).post("/_t/validate-legacy").send({ name: "" });
    assert.equal(legacyBad.status, 400);
    assert.equal(legacyBad.body.details[0].path, "body.name");

    const q = await request(app).get("/_t/validate-query");
    assert.deepEqual(q.body, { validated: { limit: 20 } });
    const qBad = await request(app).get("/_t/validate-query?limit=500");
    assert.equal(qBad.status, 400);
    assert.equal(qBad.body.details[0].path, "query.limit");
  });

  test("objectIdParam rejects bad ids with 400", async () => {
    const { app } = appWithTestRoutes();
    const bad = await request(app).get("/_t/things/not-an-id");
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error, "Invalid id");
    const id = new mongoose.Types.ObjectId().toString();
    const ok = await request(app).get(`/_t/things/${id}`);
    assert.equal(ok.body.id, id);
  });
});

describe("authentication", () => {
  test("legacy Bearer token still authenticates", async () => {
    const { app } = appWithTestRoutes();
    const user = await createTestUser();
    const res = await request(app).get("/_t/me").set(legacyBearer(user));
    assert.equal(res.status, 200);
    assert.equal(res.body.user.id, String(user._id));
    assert.equal(res.body.user.email, user.email);
    assert.equal(res.body.auth.via, "bearer");
  });

  test("legacy Bearer works on a real route (GET /chats)", async () => {
    const { app } = createTestApp();
    const user = await createTestUser();
    const res = await request(app).get("/chats").set(legacyBearer(user));
    assert.equal(res.status, 200);
  });

  test("new Bearer token and session cookie authenticate", async () => {
    const { app } = appWithTestRoutes();
    const user = await createTestUser();
    const b = await request(app).get("/_t/me").set(bearer(user));
    assert.equal(b.status, 200);
    const c = await request(app).get("/_t/me").set("Cookie", sessionCookie(user));
    assert.equal(c.status, 200);
    assert.equal(c.body.auth.via, "cookie");
  });

  test("rejections: none, garbage, wrong alg, deleted, session version, demo expiry", async () => {
    const { app } = appWithTestRoutes();
    const none = await request(app).get("/_t/me");
    assert.equal(none.status, 401);
    assert.equal(none.body.code, "UNAUTHENTICATED");

    const garbage = await request(app).get("/_t/me").set("Authorization", "Bearer abc.def.ghi");
    assert.equal(garbage.status, 401);

    const user = await createTestUser();
    const noneAlg = jwt.sign({ id: String(user._id), email: user.email, role: "Founder" }, "", { algorithm: "none" } as any);
    assert.equal((await request(app).get("/_t/me").set("Authorization", `Bearer ${noneAlg}`)).status, 401);

    // Stale cookie does not shadow a valid Bearer token
    const both = await request(app).get("/_t/me").set("Cookie", `${sessionCookieName()}=junk`).set(bearer(user));
    assert.equal(both.status, 200);

    const headers = bearer(user);
    await User.updateOne({ _id: user._id }, { $set: { sessionVersion: 1 } });
    assert.equal((await request(app).get("/_t/me").set(headers)).status, 401);
    // Legacy tokens die too once the user bumped their session version
    assert.equal((await request(app).get("/_t/me").set(legacyBearer(user))).status, 401);

    const gone = await createTestUser({ deletingAt: new Date() });
    assert.equal((await request(app).get("/_t/me").set(bearer(gone))).status, 401);

    const missing = { _id: new mongoose.Types.ObjectId(), email: "x@y.z", role: "Founder" };
    assert.equal((await request(app).get("/_t/me").set("Authorization", `Bearer ${legacyTokenFor(missing)}`)).status, 401);

    const demo = await createTestUser({ isDemo: true, demoExpiresAt: new Date(Date.now() - 1000) });
    const expired = await request(app).get("/_t/me").set(bearer(demo));
    assert.equal(expired.status, 401);
    assert.equal(expired.body.code, "DEMO_EXPIRED");
  });

  test("sliding session re-issues an old cookie", async () => {
    const { app } = appWithTestRoutes();
    const user = await createTestUser();
    const now = Math.floor(Date.now() / 1000);
    const old = jwt.sign(
      { sub: String(user._id), sv: 0, demo: false, id: String(user._id), email: user.email, role: "Founder", iat: now - 5 * 86400 },
      JWT_SECRET,
      { issuer: TOKEN_ISSUER, expiresIn: "7d" }
    );
    const res = await request(app).get("/_t/me").set("Cookie", `${sessionCookieName()}=${old}`);
    assert.equal(res.status, 200);
    const setCookie = String(res.headers["set-cookie"] ?? "");
    assert.match(setCookie, new RegExp(`${sessionCookieName()}=`));
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Lax/);

    const fresh = await request(app).get("/_t/me").set("Cookie", sessionCookie(user));
    assert.equal(fresh.headers["set-cookie"], undefined);
  });
});

describe("CSRF", () => {
  test("cookie-auth POST from a foreign Origin -> 403", async () => {
    const { app } = appWithTestRoutes();
    const user = await createTestUser();
    const evil = await cookieAgent(app, user, "https://evil.example").post("/_t/me").send({});
    assert.equal(evil.status, 403);
    assert.equal(evil.body.code, "FORBIDDEN");

    const noOrigin = await request(app).post("/_t/me").set("Cookie", sessionCookie(user)).send({});
    assert.equal(noOrigin.status, 403);

    const viaReferer = await request(app)
      .post("/_t/me")
      .set("Cookie", sessionCookie(user))
      .set("Referer", `${TEST_ORIGIN}/dashboard`)
      .send({});
    assert.equal(viaReferer.status, 200);

    const good = await cookieAgent(app, user).post("/_t/me").send({});
    assert.equal(good.status, 200);

    // Bearer requests are exempt
    const b = await request(app).post("/_t/me").set(bearer(user)).set("Origin", "https://evil.example").send({});
    assert.equal(b.status, 200);

    // GET is never blocked
    const get = await cookieAgent(app, user, "https://evil.example").get("/_t/me");
    assert.equal(get.status, 200);
  });
});

describe("meta and waitlist", () => {
  test("GET /meta", async () => {
    const { app } = createTestApp();
    const res = await request(app).get("/meta");
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.version, "string");
    for (const f of ["research", "regenerate", "feedback", "search", "export", "publicTools"]) {
      assert.ok(res.body.features.includes(f), f);
    }
    assert.ok(!res.body.features.includes("sample"));
    assert.deepEqual(res.body.limits, { maxPromptChars: 8000, freeTierLimit: 50 });
    assert.deepEqual(res.body.providers, ["gemini", "openai", "openrouter", "anthropic", "groq"]);
  });

  test("POST /waitlist anonymous and signed in", async () => {
    const { app } = createTestApp();
    const anon = await request(app).post("/waitlist").send({ feature: "postgresql", email: "Ann@Example.com" });
    assert.equal(anon.status, 201);
    const again = await request(app).post("/waitlist").send({ feature: "postgresql", email: "ann@example.com" });
    assert.equal(again.status, 201);
    assert.equal(await Waitlist.countDocuments({ feature: "postgresql" }), 1);

    const noEmail = await request(app).post("/waitlist").send({ feature: "mysql" });
    assert.equal(noEmail.status, 400);
    const badFeature = await request(app).post("/waitlist").send({ feature: "oracle", email: "a@b.co" });
    assert.equal(badFeature.status, 400);

    const user = await createTestUser();
    const signed = await request(app).post("/waitlist").set(bearer(user)).send({ feature: "mysql" });
    assert.equal(signed.status, 201);
    const row: any = await Waitlist.findOne({ feature: "mysql" }).lean();
    assert.equal(String(row.userId), String(user._id));
    assert.equal(row.email, user.email);
  });
});

describe("migrations", () => {
  test("runs once, records ids, drops username_1, respects the lock", async () => {
    const users = mongoose.connection.db!.collection("users");
    await users.createIndex({ username: 1 }, { unique: true, sparse: true });

    const ran: string[] = [];
    const list = [
      (await import("../src/migrations/001-drop-username-index")).default,
      { id: "900-test", up: async () => void ran.push("900") },
      { id: "901-fails", up: async () => { throw new Error("boom"); } },
      { id: "902-never", up: async () => void ran.push("902") },
    ];
    const first = await runMigrations({ migrations: list as any });
    assert.deepEqual(first.applied, ["001-drop-username-index", "900-test"]);
    assert.equal(first.failed?.id, "901-fails");
    assert.deepEqual(ran, ["900"]);
    assert.ok(!(await users.indexes()).some((i) => i.name === "username_1"));
    assert.ok(await Migration.findById("900-test"));

    const second = await runMigrations({ migrations: list.filter((m) => m.id !== "901-fails") as any });
    assert.deepEqual(second.applied, ["902-never"]);
    assert.deepEqual(second.skipped, ["001-drop-username-index", "900-test"]);

    // A live lock held by another process blocks the run
    await mongoose.connection.db!.collection("migrationlocks").insertOne({
      _id: "migrations" as any,
      owner: "other",
      expiresAt: new Date(Date.now() + 60_000),
    });
    const locked = await runMigrations({ migrations: [{ id: "903", up: async () => void ran.push("903") }] });
    assert.equal(locked.locked, true);
    assert.ok(!ran.includes("903"));
  });

  test("the migration list is ordered 001..007 with unique ids", () => {
    const ids = MIGRATIONS.map((m) => m.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(ids.map((id) => id.slice(0, 3)), ["001", "002", "003", "004", "005", "006", "007"]);
    for (const m of MIGRATIONS) assert.equal(typeof m.up, "function");
  });
});

describe("health", () => {
  test("/health 200 when the database answers, 503 when disconnected", async () => {
    const { app } = createTestApp();
    const up = await request(app).get("/health");
    assert.equal(up.status, 200);
    assert.equal(up.body.status, "healthy");
    assert.equal(up.body.db, "up");
    assert.equal(typeof up.body.uptimeS, "number");
    assert.ok(up.body.timestamp);

    await mongoose.disconnect();
    try {
      const down = await request(app).get("/health");
      assert.equal(down.status, 503);
      assert.equal(down.body.status, "degraded");
      assert.equal(down.body.db, "down");
    } finally {
      await startTestDb();
    }
  });
});
