import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  UNREACHABLE_HOST_MESSAGE,
  UNRESOLVABLE_HOST_MESSAGE,
  UnsafeHostError,
  assertPublicMongoUri,
  extractMongoHosts,
  isBlockedAddress,
  type HostResolvers,
} from "../src/bridges/mongo/net";

describe("isBlockedAddress", () => {
  const blocked = [
    "127.0.0.1",
    "127.255.255.254",
    "10.0.0.5",
    "10.255.255.255",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "100.64.0.1",
    "100.127.255.255",
    "169.254.169.254", // cloud metadata
    "169.254.0.1",
    "0.0.0.0",
    "0.1.2.3",
    "255.255.255.255",
    "::1",
    "::",
    "[::1]",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "fe80::1%en0",
    "febf::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1", // hex form of ::ffff:127.0.0.1
    "::ffff:10.0.0.1",
    "::ffff:169.254.169.254",
    "::ffff:192.168.0.1",
    "::127.0.0.1",
    "not-an-ip",
    "",
  ];
  const allowed = [
    "8.8.8.8",
    "1.1.1.1",
    "52.1.2.3",
    "172.15.255.255",
    "172.32.0.1",
    "100.63.255.255",
    "100.128.0.1",
    "192.169.0.1",
    "169.253.255.255",
    "11.0.0.1",
    "2606:4700:4700::1111",
    "2001:4860:4860::8888",
    "::ffff:8.8.8.8",
    "fec0::1",
  ];
  for (const ip of blocked) test(`blocks ${ip || "(empty)"}`, () => assert.equal(isBlockedAddress(ip), true));
  for (const ip of allowed) test(`allows ${ip}`, () => assert.equal(isBlockedAddress(ip), false));
});

describe("extractMongoHosts", () => {
  test("parses hosts, ports, IPv6 and SRV", () => {
    assert.deepEqual(extractMongoHosts("mongodb://u:p@Host1:27017,[::1]:27018,host3/db"), {
      hosts: ["host1", "::1", "host3"],
      srv: false,
    });
    assert.deepEqual(extractMongoHosts("mongodb+srv://u:p@cluster0.abc.mongodb.net/x"), {
      hosts: ["cluster0.abc.mongodb.net"],
      srv: true,
    });
    assert.deepEqual(extractMongoHosts("mongodb://%2Ftmp%2Fmongodb-27017.sock").hosts, ["/tmp/mongodb-27017.sock"]);
  });
});

function fakeResolvers(a: Record<string, string[]>, srv: Record<string, string[]> = {}): HostResolvers {
  return {
    lookup: async (host) => {
      if (!(host in a)) throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
      return a[host];
    },
    resolveSrv: async (name) => {
      if (!(name in srv)) throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
      return srv[name];
    },
  };
}

const env = (extra: Record<string, string> = {}) => ({ MONGODB_URI: "mongodb+srv://app.wuup-prod.mongodb.net/wup", ...extra }) as NodeJS.ProcessEnv;

describe("assertPublicMongoUri", () => {
  const resolvers = fakeResolvers(
    {
      localhost: ["127.0.0.1", "::1"],
      "public.example.com": ["52.1.2.3"],
      "evil.example.com": ["52.1.2.3", "10.0.0.7"],
      "rebind.example.com": ["169.254.169.254"],
      "v6.example.com": ["::ffff:127.0.0.1"],
      "shard-00.abc.mongodb.net": ["34.1.1.1"],
      "shard-01.abc.mongodb.net": ["34.1.1.2"],
      "internal-shard.abc.mongodb.net": ["192.168.3.4"],
      "app-shard-00.wuup-prod.mongodb.net": ["35.9.9.9"],
    },
    {
      "_mongodb._tcp.cluster0.abc.mongodb.net": ["shard-00.abc.mongodb.net", "shard-01.abc.mongodb.net"],
      "_mongodb._tcp.sneaky.abc.mongodb.net": ["shard-00.abc.mongodb.net", "internal-shard.abc.mongodb.net"],
      "_mongodb._tcp.app.wuup-prod.mongodb.net": ["app-shard-00.wuup-prod.mongodb.net"],
    }
  );
  const check = (uri: string, e = env()) => assertPublicMongoUri(uri, { env: e, resolvers });
  const rejectsWith = (uri: string, msg: string, e = env()) =>
    assert.rejects(check(uri, e), (err: any) => err instanceof UnsafeHostError && err.message === msg && err.status === 400);

  test("public hosts and SRV clusters pass", async () => {
    await check("mongodb://u:p@public.example.com:27017/db");
    await check("mongodb://u:p@52.1.2.3/db");
    await check("mongodb+srv://u:p@cluster0.abc.mongodb.net/db");
  });

  test("private, loopback and metadata hosts are rejected", async () => {
    await rejectsWith("mongodb://localhost:27017", UNREACHABLE_HOST_MESSAGE);
    await rejectsWith("mongodb://127.0.0.1", UNREACHABLE_HOST_MESSAGE);
    await rejectsWith("mongodb://[::1]:27017", UNREACHABLE_HOST_MESSAGE);
    await rejectsWith("mongodb://169.254.169.254", UNREACHABLE_HOST_MESSAGE);
    await rejectsWith("mongodb://rebind.example.com", UNREACHABLE_HOST_MESSAGE);
    await rejectsWith("mongodb://v6.example.com", UNREACHABLE_HOST_MESSAGE);
    await rejectsWith("mongodb://%2Ftmp%2Fmongodb-27017.sock", UNREACHABLE_HOST_MESSAGE);
  });

  test("any private address among several is enough to reject", async () => {
    await rejectsWith("mongodb://evil.example.com", UNREACHABLE_HOST_MESSAGE);
    await rejectsWith("mongodb://public.example.com,10.1.1.1/db", UNREACHABLE_HOST_MESSAGE);
    await rejectsWith("mongodb+srv://sneaky.abc.mongodb.net/db", UNREACHABLE_HOST_MESSAGE);
  });

  test("the app's own database is rejected", async () => {
    await rejectsWith("mongodb+srv://u:p@app.wuup-prod.mongodb.net/other", UNREACHABLE_HOST_MESSAGE);
    await rejectsWith("mongodb://u:p@app-shard-00.wuup-prod.mongodb.net:27017/x", UNREACHABLE_HOST_MESSAGE);
  });

  test("unresolvable hosts get a clear message", async () => {
    await rejectsWith("mongodb://nope.invalid", UNRESOLVABLE_HOST_MESSAGE);
    await rejectsWith("mongodb+srv://nope.invalid", UNRESOLVABLE_HOST_MESSAGE);
  });

  test("BRIDGE_ALLOW_PRIVATE_HOSTS=true allows local development", async () => {
    await check("mongodb://localhost:27017", env({ BRIDGE_ALLOW_PRIVATE_HOSTS: "true" }));
    await rejectsWith("mongodb://localhost:27017", UNREACHABLE_HOST_MESSAGE, env({ BRIDGE_ALLOW_PRIVATE_HOSTS: "1" }));
  });
});
