import "./support/env";
import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { AuthResponseSchema } from "@wup/contracts";
import { env } from "../src/config/env";
import {
  ORIGIN,
  bearer,
  buildApp,
  clearDb,
  models,
  rawSetCookie,
  request,
  sessionCookie,
  signup,
  stable,
  startDb,
  stopDb,
} from "./support/usersHarness";

const { User } = models as any;
const app = buildApp();

before(startDb);
after(stopDb);
beforeEach(async () => {
  await clearDb();
  env.LEGACY_AUTO_SIGNUP = true;
});

describe("POST /auth/signup", () => {
  test("normalises the email (NFKC, trim, lowercase) and returns AuthResponse + cookie + token", async () => {
    // Fullwidth letters fold to ASCII under NFKC
    const res = await request(app)
      .post("/auth/signup")
      .set("Origin", ORIGIN)
      .send({ email: "  ＪＯＨＮ.Doe@Example.COM ", password: "correct horse battery", name: "John" });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.user.email, "john.doe@example.com");
    assert.equal(res.body.user.name, "John");
    assert.equal(res.body.user.plan.tier, "free");
    assert.equal(res.body.user.plan.freeTierLimit, env.FREE_TIER_LIMIT);
    assert.ok(AuthResponseSchema.safeParse(res.body).success);
    assert.equal(typeof res.body.token, "string");
    assert.ok(sessionCookie(res));

    const doc = await User.findOne({ email: "john.doe@example.com" }).lean();
    assert.ok(doc);
    assert.equal(bcrypt.getRounds(doc.password), 12);
  });

  test("rejects weak passwords and passwords containing the email name", async () => {
    const short = await request(app).post("/auth/signup").send({ email: "a@b.co", password: "short" });
    assert.equal(short.status, 400);
    assert.equal(short.body.code, "VALIDATION_FAILED");

    const tooLong = await request(app).post("/auth/signup").send({ email: "a@b.co", password: "x".repeat(73) });
    assert.equal(tooLong.status, 400);

    const hasLocal = await request(app)
      .post("/auth/signup")
      .send({ email: "johnsmith@example.com", password: "JohnSmith-rules-42" });
    assert.equal(hasLocal.status, 400);
    assert.equal(hasLocal.body.code, "VALIDATION_FAILED");
    assert.equal(await User.countDocuments(), 0);
  });

  test("duplicate email (any case) is 409 CONFLICT", async () => {
    await signup(app, "dup@example.com");
    const again = await request(app).post("/auth/signup").send({ email: "DUP@example.com", password: "another good pass" });
    assert.equal(again.status, 409);
    assert.equal(again.body.code, "CONFLICT");

    // Legacy mixed-case row (pre migration 003)
    await User.collection.insertOne({ email: "Legacy@Example.com", password: "x", createdAt: new Date() });
    const legacy = await request(app).post("/auth/signup").send({ email: "legacy@example.com", password: "another good pass" });
    assert.equal(legacy.status, 409);
  });
});

describe("POST /auth/login", () => {
  test("identical 401 for a wrong password and an unknown email (auto-signup off)", async () => {
    env.LEGACY_AUTO_SIGNUP = false;
    await signup(app, "known@example.com", "the right password");

    const wrong = await request(app).post("/auth/login").send({ email: "known@example.com", password: "the wrong password" });
    const unknown = await request(app).post("/auth/login").send({ email: "nobody@example.com", password: "the wrong password" });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.body.code, "INVALID_CREDENTIALS");
    assert.deepEqual(stable(wrong.body), stable(unknown.body));
    assert.equal(await User.countDocuments({ email: "nobody@example.com" }), 0);
  });

  test("operator injection in email is 400 and creates nothing", async () => {
    const before = await User.countDocuments();
    const res = await request(app).post("/auth/login").send({ email: { $gt: "" }, password: "whatever" });
    assert.equal(res.status, 400);
    assert.equal(await User.countDocuments(), before);

    const pw = await request(app).post("/auth/login").send({ email: "x@example.com", password: { $ne: null } });
    assert.equal(pw.status, 400);
    assert.equal(await User.countDocuments(), before);
  });

  test("returns the legacy shape { token, user: { id, email, role, ... } } and updates lastLoginAt", async () => {
    const u = await signup(app, "shape@example.com", "a fine password");
    await User.updateOne({ _id: u.id }, { $unset: { lastLoginAt: 1 } });
    const res = await request(app).post("/auth/login").send({ email: "Shape@Example.com ", password: "a fine password" });
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.token, "string");
    assert.equal(res.body.user.id, u.id);
    assert.equal(res.body.user.email, "shape@example.com");
    assert.equal(res.body.user.role, "Founder");
    assert.ok(res.body.user.plan);
    const doc = await User.findById(u.id).lean();
    assert.ok(doc.lastLoginAt instanceof Date);
  });

  test("legacy auto-signup: on creates the account, off is 401", async () => {
    env.LEGACY_AUTO_SIGNUP = true;
    const on = await request(app).post("/auth/login").send({ email: "Auto@Example.com", password: "short" });
    assert.equal(on.status, 200);
    assert.equal(on.body.user.email, "auto@example.com");
    assert.equal(on.body.user.role, "Founder");

    // Same credentials now log in normally
    const again = await request(app).post("/auth/login").send({ email: "auto@example.com", password: "short" });
    assert.equal(again.status, 200);
    assert.equal(again.body.user.id, on.body.user.id);

    env.LEGACY_AUTO_SIGNUP = false;
    const off = await request(app).post("/auth/login").send({ email: "auto2@example.com", password: "whatever" });
    assert.equal(off.status, 401);
    assert.equal(await User.countDocuments({ email: "auto2@example.com" }), 0);
  });

  test("legacy demo email with no password creates an isolated demo user", async () => {
    const a = await request(app).post("/auth/login").send({ email: "google-demo@wup.ai" });
    const b = await request(app).post("/auth/login").send({ email: "Google-Demo@wup.ai", password: "" });
    assert.equal(a.status, 200, JSON.stringify(a.body));
    assert.equal(b.status, 200);
    assert.notEqual(a.body.user.id, b.body.user.id);
    assert.equal(a.body.user.isDemo, true);
    assert.match(a.body.user.email, /^demo-[0-9a-f-]+@demo\.wuup\.in$/);
    assert.equal(typeof a.body.token, "string");
  });

  test("demo users cannot log in with a password", async () => {
    const demo = await request(app).post("/auth/demo").send({});
    assert.equal(demo.status, 201);
    const res = await request(app).post("/auth/login").send({ email: demo.body.user.email, password: "anything at all" });
    assert.equal(res.status, 401);
    assert.equal(res.body.code, "INVALID_CREDENTIALS");
  });

  test("legacy mixed-case row with a cost-10 hash logs in and is upgraded to cost 12", async () => {
    const hash = await bcrypt.hash("old password", 10);
    await User.collection.insertOne({ email: "Old@Example.com", password: hash, role: "Founder", createdAt: new Date() });
    const res = await request(app).post("/auth/login").send({ email: "old@example.com", password: "old password" });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const doc = await User.collection.findOne({ email: "Old@Example.com" });
    assert.equal(bcrypt.getRounds(doc!.password), 12);
  });

  test("the 21st login attempt from one IP is 429", async () => {
    env.LEGACY_AUTO_SIGNUP = false;
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) {
      const r = await request(app)
        .post("/auth/login")
        .set("X-Forwarded-For", "203.0.113.7")
        .send({ email: "nobody@example.com", password: "nope nope" });
      statuses.push(r.status);
      if (i === 20) assert.equal(r.body.code, "RATE_LIMITED");
    }
    assert.deepEqual(statuses.slice(0, 20), Array(20).fill(401));
    assert.equal(statuses[20], 429);
  });
});

describe("sessions", () => {
  test("cookie flags: HttpOnly, SameSite=Lax, Path=/, Max-Age; not Secure outside production", async () => {
    const res = await request(app).post("/auth/signup").send({ email: "c@example.com", password: "cookie password" });
    const c = rawSetCookie(res);
    assert.match(c, /HttpOnly/i);
    assert.match(c, /SameSite=Lax/i);
    assert.match(c, /Path=\//);
    assert.match(c, /Max-Age=\d+/);
    assert.doesNotMatch(c, /;\s*Secure/i);
  });

  test("GET /auth/me works with the cookie and with Bearer; /auth/verify keeps the legacy shape", async () => {
    const u = await signup(app, "me@example.com");
    const viaCookie = await request(app).get("/auth/me").set("Cookie", u.cookie);
    assert.equal(viaCookie.status, 200);
    assert.equal(viaCookie.body.user.id, u.id);
    assert.ok(AuthResponseSchema.safeParse(viaCookie.body).success);

    const viaBearer = await request(app).get("/auth/me").set(bearer(u.token));
    assert.equal(viaBearer.status, 200);
    assert.equal(viaBearer.body.user.email, "me@example.com");

    const verify = await request(app).get("/auth/verify").set(bearer(u.token));
    assert.equal(verify.status, 200);
    assert.equal(verify.body.valid, true);
    assert.equal(verify.body.user.id, u.id);
    assert.equal(verify.body.user.email, "me@example.com");
    assert.equal(verify.body.user.role, "Founder");

    const none = await request(app).get("/auth/verify");
    assert.equal(none.status, 401);
  });

  test("logout is 204 and clears the cookie", async () => {
    const u = await signup(app);
    const res = await request(app).post("/auth/logout").set("Origin", ORIGIN).set("Cookie", u.cookie);
    assert.equal(res.status, 204);
    const c = rawSetCookie(res);
    assert.match(c, /wuup_session=;/);
    assert.match(c, /Expires=Thu, 01 Jan 1970/);
  });

  test("change-password bumps sessionVersion: old cookie and old Bearer stop working", async () => {
    const u = await signup(app, "cp@example.com", "first password!");
    const res = await request(app)
      .post("/auth/change-password")
      .set("Origin", ORIGIN)
      .set("Cookie", u.cookie)
      .send({ currentPassword: "first password!", newPassword: "second password!" });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(AuthResponseSchema.safeParse(res.body).success);
    const newCookie = sessionCookie(res);
    assert.ok(newCookie);

    assert.equal((await request(app).get("/auth/me").set("Cookie", u.cookie)).status, 401);
    assert.equal((await request(app).get("/auth/me").set(bearer(u.token))).status, 401);
    assert.equal((await request(app).get("/auth/me").set("Cookie", newCookie!)).status, 200);
    assert.equal((await request(app).get("/auth/me").set(bearer(res.body.token))).status, 200);

    const login = await request(app).post("/auth/login").send({ email: "cp@example.com", password: "second password!" });
    assert.equal(login.status, 200);
    const oldPw = await request(app).post("/auth/login").send({ email: "cp@example.com", password: "first password!" });
    assert.equal(oldPw.status, 401);
  });

  test("change-password rejects a wrong current password", async () => {
    const u = await signup(app, "cp2@example.com", "first password!");
    const res = await request(app)
      .post("/auth/change-password")
      .set(bearer(u.token))
      .send({ currentPassword: "not it at all", newPassword: "second password!" });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "VALIDATION_FAILED");
  });
});
