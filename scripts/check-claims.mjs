#!/usr/bin/env node
/**
 * Claims guard for apps/web/src: wuup does not support these yet, so copy
 * must not imply it does. Fails (exit 1) on any match outside the allowlist.
 *
 * Allowed:
 *   - files in ALLOWLIST (comparisons, roadmap content, the "coming soon" tile)
 *   - any line that mentions "roadmap" or "coming soon"
 *
 * Usage: node scripts/check-claims.mjs [dir]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const WEB = path.join(ROOT, "apps/web");
const TARGET = path.resolve(process.argv[2] ?? path.join(WEB, "src"));
const EXTENSIONS = new Set([".tsx", ".ts", ".mdx", ".md", ".css"]);

const CLAIMS = /PostgreSQL|MySQL|Supabase|SOC ?2|LangChain|\bMCP\b|\bSSO\b|team workspace/gi;
const LINE_EXEMPT = /roadmap|coming soon/i;

/** Paths relative to apps/web. Strings match exactly; RegExps match anywhere in the path. */
const ALLOWLIST = [
  // Comparison and roadmap content where competitors' features are named.
  "src/content/guides/connect-mongodb-to-chatgpt-or-claude.mdx",
  "src/content/data/compare.ts",
  "src/content/data/alternatives.ts",
  "src/content/data/faqs.ts",
  // The data-connect screen's "coming soon" source tiles.
  /src\/(app|components)\/.*data[-/]connect/,
  /src\/(app|components)\/.*connect-(tiles?|sources?)\.tsx$/,
  // Source picker "Coming soon" tile + waitlist API, legacy bridge type labels.
  "src/components/data/source-picker.tsx",
  "src/components/data/parts.tsx",
  "src/lib/bridges.ts",
  // Syntax-highlighter language aliases (not product claims).
  "src/lib/highlight.ts",
];

const isAllowed = (rel) =>
  ALLOWLIST.some((entry) => (typeof entry === "string" ? entry === rel : entry.test(rel)));

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (EXTENSIONS.has(path.extname(entry.name))) yield full;
  }
}

if (!fs.existsSync(TARGET)) {
  console.error(`check-claims: ${TARGET} does not exist`);
  process.exit(2);
}

const hits = [];
for (const file of walk(TARGET)) {
  const rel = path.relative(WEB, file).split(path.sep).join("/");
  if (isAllowed(rel)) continue;
  const lines = fs.readFileSync(file, "utf8").split("\n");
  lines.forEach((line, n) => {
    if (LINE_EXEMPT.test(line)) return;
    for (const m of line.matchAll(CLAIMS)) {
      hits.push({ file: `apps/web/${rel}`, line: n + 1, col: m.index + 1, match: m[0], text: line.trim() });
    }
  });
}

if (hits.length) {
  for (const h of hits) {
    console.log(`${h.file}:${h.line}:${h.col}  unsupported claim "${h.match}"`);
    console.log(`    ${h.text.slice(0, 160)}`);
  }
  console.log(
    `\ncheck-claims: ${hits.length} problem(s). wuup supports MongoDB, Google Sheets and PDF/TXT only.` +
      ` Mark future work with "roadmap" or "coming soon", or add a comparison file to ALLOWLIST.`
  );
  process.exit(1);
}
console.log("check-claims: ok");
