#!/usr/bin/env node
/**
 * Crawls a running server from its sitemap and checks on-page SEO.
 *
 *   BASE=http://localhost:3000 node scripts/check-seo.mjs
 *
 * Per sitemap URL:
 *   - status 200, no noindex (meta robots or X-Robots-Tag)
 *   - exactly one <h1>
 *   - <title> at most 60 chars, ending in "| wuup" (home exempt from the suffix)
 *   - meta description 110 to 160 chars
 *   - canonical equals the sitemap URL
 *   - og:image present
 *   - every ld+json block parses and has @context and @type (or an @graph of typed nodes)
 *   - BreadcrumbList on every page except home
 * Across the crawl:
 *   - every internal link resolves (2xx; redirects are warnings)
 *   - every sitemap page has at least 3 inbound internal links from other pages
 *   - sitemap and crawl agree: indexable pages linked from the site are in the sitemap
 *
 * Exit 1 on any failure.
 */

const BASE = (process.env.BASE ?? "http://localhost:3000").replace(/\/+$/, "");
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 6);
const MIN_INBOUND = Number(process.env.MIN_INBOUND ?? 3);
const TITLE_SUFFIX = "| wuup";

const failures = [];
const warnings = [];
const fail = (url, msg) => failures.push({ url, msg });
const warn = (url, msg) => warnings.push({ url, msg });

/* ---------------------------------------------------------------- */
/* HTML helpers (regex based, no dependencies)                       */
/* ---------------------------------------------------------------- */

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));

function attrs(tag) {
  const out = {};
  for (const m of tag.matchAll(/([a-zA-Z:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    out[m[1].toLowerCase()] = decode(m[3] ?? m[4] ?? m[5] ?? "");
  }
  return out;
}

const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi"))].map((m) => attrs(m[0]));

const stripScripts = (html) =>
  html.replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<style\b[\s\S]*?<\/style>/gi, "");

function parsePage(html) {
  const head = html.match(/<head\b[\s\S]*?<\/head>/i)?.[0] ?? html;
  const body = stripScripts(html);
  const metas = tags(head, "meta");
  const meta = (key, val) => metas.find((m) => m[key]?.toLowerCase() === val)?.content;
  const links = tags(head, "link");
  return {
    title: decode(head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? ""),
    description: meta("name", "description"),
    robots: meta("name", "robots") ?? "",
    canonical: links.find((l) => (l.rel ?? "").split(/\s+/).includes("canonical"))?.href,
    ogImage: meta("property", "og:image"),
    h1Count: (body.match(/<h1[\s>]/gi) ?? []).length,
    jsonld: [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(
      (m) => m[1]
    ),
    hrefs: tags(body, "a").map((a) => a.href).filter(Boolean),
  };
}

/* ---------------------------------------------------------------- */
/* URL helpers                                                       */
/* ---------------------------------------------------------------- */

let SITE_ORIGIN = null;

const normPath = (p) => {
  const clean = p.split("#")[0].split("?")[0];
  return clean.length > 1 ? clean.replace(/\/+$/, "") : "/";
};

/** Internal path for an href, or null for external/non-http links. */
function internalPath(href, fromPath) {
  if (!href || /^(mailto:|tel:|javascript:|#)/i.test(href)) return null;
  let u;
  try {
    u = new URL(href, BASE + fromPath);
  } catch {
    return null;
  }
  const origin = u.origin;
  if (origin !== new URL(BASE).origin && origin !== SITE_ORIGIN) return null;
  return normPath(u.pathname);
}

const isNoindex = (res, robots) =>
  /noindex/i.test(res.headers.get("x-robots-tag") ?? "") || /noindex/i.test(robots ?? "");

async function get(path) {
  return fetch(BASE + path, { redirect: "manual", headers: { "user-agent": "wuup-check-seo" } });
}

async function pool(items, fn) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (queue.length) await fn(queue.shift());
    })
  );
}

/* ---------------------------------------------------------------- */
/* Checks                                                            */
/* ---------------------------------------------------------------- */

function checkJsonLd(url, blocks, isHome) {
  const types = new Set();
  if (!blocks.length) fail(url, "no ld+json blocks");
  blocks.forEach((raw, i) => {
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      fail(url, `ld+json block ${i + 1} does not parse: ${e.message}`);
      return;
    }
    for (const node of Array.isArray(data) ? data : [data]) {
      if (!node["@context"]) fail(url, `ld+json block ${i + 1} has no @context`);
      const nodes = node["@graph"] ?? [node];
      if (!nodes.length) fail(url, `ld+json block ${i + 1} has an empty @graph`);
      for (const n of nodes) {
        if (!n["@type"]) fail(url, `ld+json block ${i + 1} has a node without @type`);
        [].concat(n["@type"] ?? []).forEach((t) => types.add(t));
        if (n["@type"] === "FAQPage" || n["@type"] === "HowTo")
          warn(url, `${n["@type"]} schema is retired for rich results; remove it`);
      }
    }
  });
  if (!isHome && !types.has("BreadcrumbList")) fail(url, "no BreadcrumbList structured data");
}

async function main() {
  const sm = await fetch(`${BASE}/sitemap.xml`).catch((e) => {
    console.error(`check-seo: cannot reach ${BASE}/sitemap.xml (${e.message}). Is the server running?`);
    process.exit(2);
  });
  if (!sm.ok) {
    console.error(`check-seo: ${BASE}/sitemap.xml returned ${sm.status}`);
    process.exit(2);
  }
  const locs = [...(await sm.text()).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => decode(m[1]));
  if (!locs.length) {
    console.error("check-seo: sitemap has no URLs");
    process.exit(1);
  }
  SITE_ORIGIN = new URL(locs[0]).origin;

  /** path -> sitemap URL */
  const sitemap = new Map(locs.map((loc) => [normPath(new URL(loc).pathname), loc]));
  /** target path -> set of source paths */
  const inbound = new Map();
  /** every internal link target -> first page that linked it */
  const linked = new Map();

  console.log(`check-seo: crawling ${sitemap.size} URL(s) from ${BASE} (site origin ${SITE_ORIGIN})`);

  await pool([...sitemap.entries()], async ([path, loc]) => {
    const isHome = path === "/";
    const res = await get(path);
    if (res.status !== 200) {
      fail(loc, `status ${res.status}${res.headers.get("location") ? ` -> ${res.headers.get("location")}` : ""}`);
      return;
    }
    const page = parsePage(await res.text());

    if (isNoindex(res, page.robots)) fail(loc, "marked noindex");
    if (page.h1Count !== 1) fail(loc, `${page.h1Count} <h1> elements (want exactly 1)`);

    if (!page.title) fail(loc, "missing <title>");
    else {
      if (page.title.length > 60) fail(loc, `title is ${page.title.length} chars (max 60): "${page.title}"`);
      if (!isHome && !page.title.endsWith(TITLE_SUFFIX)) fail(loc, `title does not end with "${TITLE_SUFFIX}": "${page.title}"`);
    }

    const d = page.description ?? "";
    if (!d) fail(loc, "missing meta description");
    else if (d.length < 110 || d.length > 160) fail(loc, `description is ${d.length} chars (want 110 to 160)`);

    const canon = page.canonical ? page.canonical.replace(/\/+$/, "") : "";
    if (!canon) fail(loc, "missing canonical");
    else if (canon !== loc.replace(/\/+$/, "")) fail(loc, `canonical ${page.canonical} does not match`);

    if (!page.ogImage) fail(loc, "missing og:image");
    checkJsonLd(loc, page.jsonld, isHome);

    for (const href of page.hrefs) {
      const target = internalPath(href, path);
      if (!target) continue;
      if (!linked.has(target)) linked.set(target, loc);
      if (target === path) continue;
      if (!inbound.has(target)) inbound.set(target, new Set());
      inbound.get(target).add(path);
    }
  });

  // Internal links resolve; indexable linked pages are in the sitemap.
  const extra = [...linked.keys()].filter((p) => !sitemap.has(p));
  await pool(extra, async (path) => {
    const from = linked.get(path);
    let res;
    try {
      res = await get(path);
    } catch (e) {
      fail(from, `link to ${path} failed: ${e.message}`);
      return;
    }
    if (res.status >= 300 && res.status < 400) {
      warn(from, `links to ${path}, which redirects (${res.status}) to ${res.headers.get("location")}`);
      return;
    }
    if (res.status !== 200) {
      fail(from, `broken internal link ${path} (status ${res.status})`);
      return;
    }
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("text/html")) return;
    const page = parsePage(await res.text());
    if (!isNoindex(res, page.robots)) fail(from, `links to indexable page ${path}, which is missing from the sitemap`);
  });

  for (const [path, loc] of sitemap) {
    const count = inbound.get(path)?.size ?? 0;
    if (count < MIN_INBOUND) fail(loc, `${count} inbound internal link(s) (want at least ${MIN_INBOUND})`);
  }

  for (const w of warnings) console.log(`warn  ${w.url}  ${w.msg}`);
  for (const f of failures) console.log(`FAIL  ${f.url}  ${f.msg}`);
  console.log(
    `\ncheck-seo: ${sitemap.size} page(s), ${linked.size} internal link target(s), ${failures.length} failure(s), ${warnings.length} warning(s)`
  );
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
