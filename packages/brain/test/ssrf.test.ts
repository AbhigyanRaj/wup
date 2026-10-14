import { test, describe } from "node:test";
import assert from "node:assert/strict";
import dns from "dns";
import { UnsafeHostError, assertNoBlockedLiteralHosts, safeLookup } from "../src/bridges/net/ssrf";

function lookup(host: string, options: dns.LookupOptions = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    safeLookup(host, options, (err, address, family) => (err ? reject(err) : resolve({ address, family })));
  });
}

describe("safeLookup", () => {
  test("refuses hostnames that resolve to loopback", async () => {
    await assert.rejects(lookup("localhost"), (e: any) => e instanceof UnsafeHostError && e.code === "EBLOCKEDHOST");
    await assert.rejects(lookup("localhost", { all: true }), UnsafeHostError);
  });

  test("passes resolver errors through", async () => {
    await assert.rejects(lookup("no-such-host.invalid"), (e: any) => !(e instanceof UnsafeHostError));
  });

  test("works with the (hostname, callback) signature", async () => {
    await assert.rejects(
      new Promise((resolve, reject) => (safeLookup as any)("localhost", (err: any, a: any) => (err ? reject(err) : resolve(a)))),
      UnsafeHostError
    );
  });
});

describe("assertNoBlockedLiteralHosts", () => {
  test("blocks private IP literals and unix sockets", () => {
    for (const uri of [
      "mongodb://127.0.0.1",
      "mongodb://10.1.2.3:27017,8.8.8.8:27017",
      "mongodb://[::1]:27017",
      "mongodb://%2Ftmp%2Fmongodb-27017.sock",
    ]) {
      assert.throws(() => assertNoBlockedLiteralHosts(uri), UnsafeHostError, uri);
    }
  });

  test("allows public IPs and hostnames (hostnames are checked at DNS time)", () => {
    assert.doesNotThrow(() => assertNoBlockedLiteralHosts("mongodb://8.8.8.8:27017"));
    assert.doesNotThrow(() => assertNoBlockedLiteralHosts("mongodb+srv://u:p@cluster0.example.net/db"));
  });

  test("unparseable URIs are refused", () => {
    assert.throws(() => assertNoBlockedLiteralHosts("mongodb://"), UnsafeHostError);
  });
});
