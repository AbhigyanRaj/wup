import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  IDLE_CLOSE_MS,
  MAX_POOLED_CLIENTS,
  clientOptionsFor,
  poolStats,
  releasePooledClient,
  setClientFactory,
  sweepIdle,
  systemPoolKey,
  withPooledClient,
  withTempClient,
} from "../src/bridges/mongo/clientPool";
import { UnsafeHostError, safeLookup } from "../src/bridges/net/ssrf";

interface FakeClient {
  uri: string;
  options: any;
  closed: boolean;
  connect(): Promise<FakeClient>;
  close(): Promise<void>;
  db(): any;
}

let created: FakeClient[] = [];

function install() {
  created = [];
  setClientFactory((uri, options) => {
    const c: FakeClient = {
      uri,
      options,
      closed: false,
      connect: async () => c,
      close: async () => {
        c.closed = true;
      },
      db: () => ({}),
    };
    created.push(c);
    return c as any;
  });
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

const flush = () => new Promise((r) => setImmediate(r));

function drainPool() {
  for (const { key } of poolStats()) releasePooledClient(key);
}

describe("client pool", () => {
  beforeEach(() => {
    process.env.BRIDGE_ALLOW_PRIVATE_HOSTS = "true";
    drainPool();
    install();
  });
  afterEach(() => {
    drainPool();
    setClientFactory(null);
    delete process.env.BRIDGE_ALLOW_PRIVATE_HOSTS;
  });

  test("reuses one client per key and URI", async () => {
    await withPooledClient("a", "mongodb://h/1", async () => 1);
    await withPooledClient("a", "mongodb://h/1", async () => 2);
    assert.equal(created.length, 1);
    await withPooledClient("a", "mongodb://h/2", async () => 3);
    assert.equal(created.length, 2);
    await flush();
    assert.equal(created[0].closed, true, "old URI's client closed");
  });

  test("the idle sweeper skips in-flight clients", async () => {
    const gate = deferred();
    const running = withPooledClient("busy", "mongodb://h/busy", () => gate.promise);
    await flush();
    await withPooledClient("idle", "mongodb://h/idle", async () => undefined);

    const later = Date.now() + IDLE_CLOSE_MS + 1000;
    assert.equal(sweepIdle(later), 1);
    await flush();
    const [busy, idle] = created;
    assert.equal(busy.closed, false);
    assert.equal(idle.closed, true);
    assert.deepEqual(poolStats().map((s) => s.key), ["busy"]);

    gate.resolve();
    await running;
    assert.equal(sweepIdle(Date.now() + IDLE_CLOSE_MS + 1000), 1);
    await flush();
    assert.equal(busy.closed, true);
  });

  test("LRU eviction skips in-flight clients", async () => {
    const gate = deferred();
    const running = withPooledClient("oldest-busy", "mongodb://h/x", () => gate.promise);
    await flush();
    for (let i = 1; i < MAX_POOLED_CLIENTS; i++) {
      await withPooledClient(`k${i}`, `mongodb://h/${i}`, async () => undefined);
    }
    assert.equal(poolStats().length, MAX_POOLED_CLIENTS);

    // Pool is full: the next new key evicts the least recently used idle entry (k1)
    await withPooledClient("new", "mongodb://h/new", async () => undefined);
    await flush();
    const keys = poolStats().map((s) => s.key);
    assert.ok(keys.includes("oldest-busy"), "busy client kept");
    assert.ok(!keys.includes("k1"), "LRU idle client evicted");
    assert.equal(created[0].closed, false);
    assert.equal(created[1].closed, true);

    gate.resolve();
    await running;
  });

  test("releasePooledClient defers closing until the last query finishes", async () => {
    const gate = deferred();
    let sawClosed: boolean | undefined;
    const running = withPooledClient("r", "mongodb://h/r", async (client: any) => {
      await gate.promise;
      sawClosed = client.closed;
      return "done";
    });
    await flush();
    releasePooledClient("r");
    await flush();
    assert.equal(created[0].closed, false, "not closed mid-query");
    assert.equal(poolStats().length, 0, "removed from the pool right away");

    gate.resolve();
    assert.equal(await running, "done");
    assert.equal(sawClosed, false);
    await flush();
    assert.equal(created[0].closed, true, "closed once idle");

    // A new acquire after release opens a fresh client
    await withPooledClient("r", "mongodb://h/r", async () => undefined);
    assert.equal(created.length, 2);
  });

  test("a failed connect is not kept in the pool", async () => {
    setClientFactory(() => ({ connect: async () => Promise.reject(new Error("boom")), close: async () => {}, db: () => ({}) }) as any);
    await assert.rejects(withPooledClient("f", "mongodb://h/f", async () => 1), /boom/);
    await flush();
    assert.equal(poolStats().length, 0);
  });

  test("system bridges use a hashed key", () => {
    const key = systemPoolKey("mongodb+srv://u:p@sample.example.net");
    assert.match(key, /^system:[a-f0-9]{64}$/);
    assert.equal(key.includes("sample.example.net"), false);
  });
});

describe("client pool SSRF guard", () => {
  beforeEach(() => {
    delete process.env.BRIDGE_ALLOW_PRIVATE_HOSTS;
    install();
  });
  afterEach(() => {
    drainPool();
    setClientFactory(null);
  });

  test("user bridges get the safe DNS lookup", () => {
    const opts = clientOptionsFor("mongodb+srv://u:p@cluster0.example.net/");
    assert.equal(opts.lookup, safeLookup as any);
  });

  test("system bridges and local development skip it", () => {
    assert.equal(clientOptionsFor("mongodb://127.0.0.1", { system: true }).lookup, undefined);
    process.env.BRIDGE_ALLOW_PRIVATE_HOSTS = "true";
    assert.equal(clientOptionsFor("mongodb://127.0.0.1").lookup, undefined);
    delete process.env.BRIDGE_ALLOW_PRIVATE_HOSTS;
  });

  test("private IP literals and unix sockets are refused before connecting", async () => {
    for (const uri of ["mongodb://127.0.0.1:27017", "mongodb://169.254.169.254", "mongodb://%2Ftmp%2Fmongodb-27017.sock"]) {
      await assert.rejects(withPooledClient("x", uri, async () => 1), UnsafeHostError, uri);
      await assert.rejects(withTempClient(uri, async () => 1), UnsafeHostError, uri);
    }
    assert.equal(created.length, 0);
  });
});
