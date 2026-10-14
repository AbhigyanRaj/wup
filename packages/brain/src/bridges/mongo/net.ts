import dns from "dns";
import net from "net";
import ConnectionString from "mongodb-connection-string-url";

/**
 * SSRF guard for user-supplied MongoDB URIs.
 *
 * Bridges must point at publicly reachable databases. A URI whose hosts
 * resolve to loopback, private, carrier-grade NAT, link-local (including the
 * cloud metadata service) or other non-routable ranges is rejected, as is the
 * app's own database (MONGODB_URI, matched by hostname). Developers can set
 * BRIDGE_ALLOW_PRIVATE_HOSTS=true locally to bridge a local mongod.
 *
 * This is a create/test-time check: it does not defend against DNS rebinding
 * between this check and the driver's own resolution.
 */

export const UNREACHABLE_HOST_MESSAGE =
  "That host isn't reachable from wuup. Use a public MongoDB address (for example MongoDB Atlas).";
export const UNRESOLVABLE_HOST_MESSAGE =
  "We couldn't find that host. Check the address in your connection string.";

export class UnsafeHostError extends Error {
  readonly status = 400;
  constructor(message: string = UNREACHABLE_HOST_MESSAGE) {
    super(message);
    this.name = "UnsafeHostError";
  }
}

const IPV4_BLOCKED: Array<[string, number]> = [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, incl. 169.254.169.254 metadata
  ["172.16.0.0", 12], // private
  ["192.168.0.0", 16], // private
  ["224.0.0.0", 3], // multicast + reserved + broadcast (never a database)
];

const IPV6_BLOCKED: Array<[string, number]> = [
  ["::", 128], // unspecified
  ["::1", 128], // loopback
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
];

const blockList = new net.BlockList();
for (const [addr, prefix] of IPV4_BLOCKED) {
  blockList.addSubnet(addr, prefix, "ipv4");
  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible (::a.b.c.d) forms
  blockList.addSubnet(`::ffff:${addr}`, 96 + prefix, "ipv6");
  blockList.addSubnet(`::${addr}`, 96 + prefix, "ipv6");
}
for (const [addr, prefix] of IPV6_BLOCKED) blockList.addSubnet(addr, prefix, "ipv6");

/** True if an IP literal is loopback / private / link-local / otherwise not a public address. */
export function isBlockedAddress(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, "").split("%")[0]; // strip brackets and IPv6 zone id
  const family = net.isIP(ip);
  if (family === 4) return blockList.check(ip, "ipv4");
  if (family === 6) return blockList.check(ip, "ipv6");
  return true; // not an IP at all: refuse rather than guess
}

/** Hostnames (no ports, no brackets, lowercased) from a MongoDB URI. */
export function extractMongoHosts(uri: string): { hosts: string[]; srv: boolean } {
  const cs = new ConnectionString(uri.trim());
  const hosts = cs.hosts.map((h) => {
    const decoded = safeDecode(h);
    if (decoded.startsWith("[")) return decoded.slice(1, decoded.indexOf("]")).toLowerCase();
    // Unix domain sockets ("/tmp/mongodb-27017.sock") have no port to strip
    if (decoded.includes("/")) return decoded;
    return decoded.replace(/:\d*$/, "").toLowerCase();
  });
  return { hosts, srv: cs.isSRV };
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export interface HostResolvers {
  lookup: (host: string) => Promise<string[]>;
  resolveSrv: (name: string) => Promise<string[]>;
}

const DNS_TIMEOUT_MS = 5000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("DNS lookup timed out")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

const defaultResolvers: HostResolvers = {
  lookup: async (host) =>
    (await withTimeout(dns.promises.lookup(host, { all: true, verbatim: true }), DNS_TIMEOUT_MS)).map((a) => a.address),
  resolveSrv: async (name) =>
    (await withTimeout(dns.promises.resolveSrv(name), DNS_TIMEOUT_MS)).map((r) => r.name.toLowerCase().replace(/\.$/, "")),
};

/** Resolves every host a URI would connect to (expanding mongodb+srv). Returns hostnames and IPs. */
async function resolveUriTargets(
  uri: string,
  resolvers: HostResolvers
): Promise<{ hostnames: string[]; addresses: string[] }> {
  const { hosts, srv } = extractMongoHosts(uri);
  let hostnames = hosts;
  if (srv) {
    const targets: string[] = [];
    for (const h of hosts) targets.push(...(await resolvers.resolveSrv(`_mongodb._tcp.${h}`)));
    hostnames = [...hosts, ...targets];
  }
  const toConnect = srv ? hostnames.slice(hosts.length) : hostnames;
  const addresses: string[] = [];
  for (const h of toConnect) {
    if (h.includes("/")) {
      addresses.push(h); // unix socket path: isBlockedAddress() rejects it
      continue;
    }
    addresses.push(...(net.isIP(h) ? [h] : await resolvers.lookup(h)));
  }
  return { hostnames, addresses };
}

let appTargetsCache: { uri: string; promise: Promise<{ hostnames: string[]; addresses: string[] }> } | undefined;

/** The app's own database hosts/IPs (best effort, cached per MONGODB_URI). */
function appDatabaseTargets(appUri: string | undefined, resolvers: HostResolvers, useCache: boolean) {
  if (!appUri) return Promise.resolve({ hostnames: [], addresses: [] });
  const compute = () =>
    resolveUriTargets(appUri, resolvers).catch(() => {
      try {
        return { hostnames: extractMongoHosts(appUri).hosts, addresses: [] as string[] };
      } catch {
        return { hostnames: [] as string[], addresses: [] as string[] };
      }
    });
  if (!useCache) return compute();
  if (!appTargetsCache || appTargetsCache.uri !== appUri) {
    appTargetsCache = { uri: appUri, promise: compute() };
  }
  return appTargetsCache.promise;
}

/**
 * Throws UnsafeHostError (status 400, user-facing message) if a MongoDB URI
 * points at a non-public address or at the app's own database.
 */
export async function assertPublicMongoUri(
  uri: string,
  options: { env?: NodeJS.ProcessEnv; resolvers?: HostResolvers } = {}
): Promise<void> {
  const env = options.env ?? process.env;
  if (env.BRIDGE_ALLOW_PRIVATE_HOSTS === "true") return; // local development only

  const resolvers = options.resolvers ?? defaultResolvers;
  let target: { hostnames: string[]; addresses: string[] };
  try {
    target = await resolveUriTargets(uri, resolvers);
  } catch (err) {
    if (err instanceof UnsafeHostError) throw err;
    throw new UnsafeHostError(UNRESOLVABLE_HOST_MESSAGE);
  }
  if (target.addresses.length === 0) throw new UnsafeHostError(UNRESOLVABLE_HOST_MESSAGE);
  if (target.addresses.some(isBlockedAddress)) throw new UnsafeHostError();

  // Compared by hostname (incl. SRV targets) rather than IP: shared hosting
  // (e.g. Atlas shared tiers) can put unrelated clusters behind the same IPs.
  const app = await appDatabaseTargets(env.MONGODB_URI, resolvers, options.resolvers === undefined);
  const appHosts = new Set(app.hostnames);
  if (target.hostnames.some((h) => appHosts.has(h))) {
    throw new UnsafeHostError();
  }
}
