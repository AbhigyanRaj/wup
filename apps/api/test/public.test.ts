/**
 * /public tools: input hygiene, per-IP rate limits, the global daily cap,
 * the 7 day cache and the read-only guard on model output.
 * The model is mocked; nothing calls Gemini.
 */
import "./support/env";
import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import "@wup/models";
import { createPublicRouter, type PublicRouterOptions } from "../src/routes/public";
import { errorHandler, notFoundHandler } from "../src/middleware/error";

let server: MongoMemoryServer;

function makeApp(opts: PublicRouterOptions = {}) {
  const app = express();
  app.use("/public", express.json({ limit: "24kb" }), createPublicRouter({ turnstileSecret: "", ...opts }));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

let calls = 0;
const fakeQuery = async (input: Record<string, unknown>) => {
  calls++;
  return {
    kind: "find",
    collection: (input.collection as string) || "orders",
    filter: { status: "shipped" },
    limit: 20,
    explanation: ["Matches shipped orders."],
    assumptions: [],
    warnings: [],
  };
};

const SAMPLE = JSON.stringify({ _id: 1, status: "shipped", total: 42 });

describe("public tools", () => {
  before(async () => {
    server = await MongoMemoryServer.create();
    await mongoose.connect(server.getUri(), { dbName: "wuup_public_test" });
  });
  after(async () => {
    await mongoose.disconnect();
    await server.stop();
  });
  beforeEach(async () => {
    calls = 0;
    for (const c of await mongoose.connection.db!.collections()) await c.deleteMany({});
  });

  it("rejects inputs that contain credentials with 400", async () => {
    const app = makeApp({ generators: { "mongodb-query": fakeQuery } });
    const inputs = [
      { prompt: "orders over 100", schema: "mongodb+srv://admin:hunter2@cluster0.example.net/shop" },
      { prompt: "connect with mongodb://localhost:27017 and list users" },
      { prompt: "users", schema: "-----BEGIN PRIVATE KEY-----\nMIIE..." },
      { prompt: "use key sk-proj-abcdefghijklmnopqrstuvwxyz0123456789 to find orders" },
    ];
    for (const body of inputs) {
      const res = await request(app).post("/public/tools/mongodb-query").send(body);
      assert.equal(res.status, 400, JSON.stringify(res.body));
      assert.match(res.body.error, /Don't paste credentials; a sample document is enough/);
    }
    assert.equal(calls, 0, "the model is never called for credential inputs");
  });

  it("returns 429 with a signupUrl on the 6th request in a minute", async () => {
    const app = makeApp({ generators: { "mongodb-query": fakeQuery } });
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post("/public/tools/mongodb-query").send({ prompt: `orders ${i}`, schema: SAMPLE });
      assert.equal(res.status, 200, JSON.stringify(res.body));
    }
    const res = await request(app).post("/public/tools/mongodb-query").send({ prompt: "orders 6", schema: SAMPLE });
    assert.equal(res.status, 429);
    assert.equal(res.body.code, "RATE_LIMITED");
    assert.match(res.body.signupUrl, /\/login\?mode=signup$/);
    assert.ok(res.body.retryAfterS > 0);
  });

  it("returns 503 once the global daily cap is used up", async () => {
    const app = makeApp({ dailyCap: 2, generators: { "mongodb-query": fakeQuery } });
    for (let i = 0; i < 2; i++) {
      const res = await request(app).post("/public/tools/mongodb-query").send({ prompt: `cap ${i}` });
      assert.equal(res.status, 200);
    }
    const res = await request(app).post("/public/tools/mongodb-query").send({ prompt: "cap 3" });
    assert.equal(res.status, 503);
    assert.equal(res.body.code, "MODEL_UNAVAILABLE");
    assert.equal(calls, 2);
  });

  it("serves a repeated request from the cache with cached: true", async () => {
    const app = makeApp({ generators: { "mongodb-query": fakeQuery } });
    const body = { prompt: "shipped orders", collection: "orders", schema: SAMPLE };
    const first = await request(app).post("/public/tools/mongodb-query").send(body);
    assert.equal(first.status, 200);
    assert.equal(first.body.cached, false);
    // Whitespace differences normalise to the same key
    const second = await request(app)
      .post("/public/tools/mongodb-query")
      .send({ ...body, prompt: "  shipped   orders " });
    assert.equal(second.status, 200);
    assert.equal(second.body.cached, true);
    assert.deepEqual(second.body.filter, { status: "shipped" });
    assert.equal(calls, 1);
  });

  it("rejects model output containing $merge, after one retry", async () => {
    let modelCalls = 0;
    const app = makeApp({
      complete: async () => {
        modelCalls++;
        return JSON.stringify({
          kind: "aggregate",
          collection: "orders",
          pipelineJson: JSON.stringify([{ $match: { status: "paid" } }, { $merge: { into: "report" } }]),
          explanation: ["Writes a report."],
          assumptions: [],
          warnings: [],
        });
      },
    });
    const res = await request(app).post("/public/tools/mongodb-aggregation").send({ prompt: "save paid orders to report" });
    assert.equal(res.status, 422, JSON.stringify(res.body));
    assert.equal(modelCalls, 2, "regenerates once with the guard error as feedback");
    assert.equal(res.body.pipeline, undefined);
  });

  it("recovers when the retry returns a safe pipeline", async () => {
    const answers = [
      { pipelineJson: JSON.stringify([{ $out: "copy" }]) },
      { pipelineJson: JSON.stringify([{ $group: { _id: "$status", n: { $sum: 1 } } }]) },
    ];
    let i = 0;
    const app = makeApp({
      complete: async ({ user }) => {
        if (i === 1) assert.match(user, /previous answer was rejected/);
        const a = answers[i++];
        return JSON.stringify({ kind: "aggregate", collection: "orders", ...a, explanation: ["x"], assumptions: [], warnings: [] });
      },
    });
    const res = await request(app).post("/public/tools/mongodb-aggregation").send({ prompt: "count by status" });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.pipeline, [{ $group: { _id: "$status", n: { $sum: 1 } } }]);
  });

  it("honours the PUBLIC_TOOLS_ENABLED kill switch", async () => {
    const app = makeApp({ enabled: false, generators: { "mongodb-query": fakeQuery } });
    const res = await request(app).post("/public/tools/mongodb-query").send({ prompt: "x" });
    assert.equal(res.status, 503);
  });

  it("stores contact messages", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/public/contact")
      .send({ name: "Asha", email: "asha@example.com", topic: "Question", message: "Does wuup support Atlas?" });
    assert.equal(res.status, 201);
    const count = await mongoose.connection.db!.collection("contactmessages").countDocuments();
    assert.equal(count, 1);
  });
});
