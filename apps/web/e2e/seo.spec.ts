/**
 * SEO verification suite for the public site.
 *
 *   BASE=http://localhost:3000 npx playwright test e2e/seo.spec.ts --project=desktop --workers=2
 *
 * (The app's playwright.config.ts declares webServers; BASE must point at an
 * already-running server so none is started.)
 *
 * For every URL in /sitemap.xml:
 *   - responds 200
 *   - exactly one <h1>
 *   - every application/ld+json block parses (and BreadcrumbList is present off the home page)
 *   - a canonical link that matches the sitemap URL's path
 *   - an og:image meta tag
 *   - no em dash (U+2014) in the visible body text
 *   - no horizontal scroll at a 390px viewport
 *
 * The sitemap is split into SHARDS so the work runs in parallel workers.
 */

import { expect, test, type APIRequestContext, type APIResponse, type Page } from "@playwright/test";

const BASE = (process.env.BASE ?? "http://localhost:3000").replace(/\/+$/, "");
const SHARDS = Number(process.env.SEO_SHARDS ?? 4);
const EM_DASH = "—";

test.describe.configure({ mode: "parallel" });

/** Retries connection errors for up to ~90s: a dev server restarting mid-run is not a page failure. */
async function retry<T>(fn: () => Promise<T>, tries = 30): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!/ECONNREFUSED|ECONNRESET|socket hang up|ERR_CONNECTION|ERR_EMPTY_RESPONSE|aborted/i.test(String(err))) throw err;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw last;
}

const fetchPage = (request: APIRequestContext, path: string): Promise<APIResponse> =>
  retry(() => request.get(`${BASE}${path}`, { maxRedirects: 0, timeout: 120_000 }));

const visit = (page: Page, path: string) => retry(() => page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 120_000 }));

async function sitemapPaths(request: APIRequestContext): Promise<string[]> {
  const res = await fetchPage(request, "/sitemap.xml");
  expect(res.status(), "sitemap.xml status").toBe(200);
  const xml = await res.text();
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
  expect(locs.length, "sitemap has URLs").toBeGreaterThan(0);
  return locs.map((loc) => {
    const u = new URL(loc);
    return u.pathname === "" ? "/" : u.pathname;
  });
}

const shardOf = <T,>(items: T[], i: number) => items.filter((_, n) => n % SHARDS === i);

const normalise = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : "/");

function visibleText(html: string): string {
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
  return body
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<template\b[\s\S]*?<\/template>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&mdash;|&#8212;|&#x2014;/gi, EM_DASH);
}

for (let shard = 0; shard < SHARDS; shard++) {
  test(`sitemap pages: status, h1, JSON-LD, canonical, og:image, no em dash (shard ${shard + 1}/${SHARDS})`, async ({ request }) => {
    test.setTimeout(10 * 60 * 1000);
    const paths = shardOf(await sitemapPaths(request), shard);
    for (const path of paths) {
      const res = await fetchPage(request, path);
      expect.soft(res.status(), `${path} status`).toBe(200);
      if (res.status() !== 200) continue;
      const html = await retry(() => res.text());
      const head = html.match(/<head\b[\s\S]*?<\/head>/i)?.[0] ?? html;

      const withoutScripts = html.replace(/<script\b[\s\S]*?<\/script>/gi, "");
      const h1s = (withoutScripts.match(/<h1[\s>]/gi) ?? []).length;
      expect.soft(h1s, `${path} has exactly one <h1>`).toBe(1);

      const blocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
      expect.soft(blocks.length, `${path} has JSON-LD`).toBeGreaterThan(0);
      const types = new Set<string>();
      for (const [i, raw] of blocks.entries()) {
        let data: unknown;
        try {
          data = JSON.parse(raw);
        } catch (err) {
          expect.soft(false, `${path} ld+json block ${i + 1} parses: ${(err as Error).message}`).toBe(true);
          continue;
        }
        const nodes = (data as { "@graph"?: unknown[] })["@graph"] ?? [data];
        for (const n of nodes as Array<{ "@type"?: string | string[] }>) [n["@type"] ?? []].flat().forEach((t) => types.add(t));
      }
      if (path !== "/") expect.soft(types.has("BreadcrumbList"), `${path} has BreadcrumbList`).toBe(true);

      const canonical = head.match(/<link[^>]+rel="canonical"[^>]*>/i)?.[0]?.match(/href="([^"]+)"/)?.[1];
      expect.soft(canonical, `${path} has a canonical link`).toBeTruthy();
      if (canonical) expect.soft(normalise(new URL(canonical, BASE).pathname), `${path} canonical`).toBe(normalise(path));

      const ogImage = /<meta[^>]+property="og:image"[^>]*>/i.test(head);
      expect.soft(ogImage, `${path} has og:image`).toBe(true);

      const text = visibleText(html);
      const at = text.indexOf(EM_DASH);
      expect
        .soft(at, `${path} has an em dash near: "${at >= 0 ? text.slice(Math.max(0, at - 40), at + 40).replace(/\s+/g, " ") : ""}"`)
        .toBe(-1);
    }
  });

  test(`sitemap pages: no horizontal scroll at 390px (shard ${shard + 1}/${SHARDS})`, async ({ browser, request }) => {
    test.setTimeout(10 * 60 * 1000);
    const paths = shardOf(await sitemapPaths(request), shard);
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    for (const path of paths) {
      const res = await visit(page, path);
      if (!res || res.status() !== 200) continue;
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect.soft(overflow, `${path} overflows horizontally by ${overflow}px at 390`).toBeLessThanOrEqual(0);
    }
    await context.close();
  });
}
