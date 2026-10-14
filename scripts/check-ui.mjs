#!/usr/bin/env node
/**
 * UI copy and style guard for apps/web/src.
 *
 * Fails (exit 1) on:
 *   - em dash (U+2014) anywhere
 *   - en dash (U+2013) used as punctuation (allowed only between digits, e.g. 10–20)
 *   - "dark:" (the site is light-only; no dark variants)
 *   - #ff5f1f (retired brand orange)
 *
 * Usage: node scripts/check-ui.mjs [dir]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const TARGET = path.resolve(process.argv[2] ?? path.join(ROOT, "apps/web/src"));
const EXTENSIONS = new Set([".tsx", ".ts", ".mdx", ".md", ".css"]);

const EM_DASH = "—";
const EN_DASH = "–";

const RULES = [
  {
    name: "em dash",
    test: (line) => indexesOf(line, EM_DASH),
    hint: "use a colon, comma, parentheses or a new sentence",
  },
  {
    name: "en dash as punctuation",
    test: (line) =>
      indexesOf(line, EN_DASH).filter((i) => !(/\d/.test(line[i - 1] ?? "") && /\d/.test(line[i + 1] ?? ""))),
    hint: "use a hyphen, a colon or \"to\"; en dashes are only allowed between digits",
  },
  {
    name: "dark: variant",
    // Tailwind variant only: "--shadow-dark:" style custom properties are fine.
    test: (line) => [...line.matchAll(/(^|[^\w-])dark:/g)].map((m) => m.index + m[1].length),
    hint: "the site is light-only",
  },
  {
    name: "retired orange #ff5f1f",
    test: (line) => indexesOf(line.toLowerCase(), "#ff5f1f"),
    hint: "use the blue palette tokens",
  },
];

function indexesOf(haystack, needle) {
  const out = [];
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    out.push(i);
    i = haystack.indexOf(needle, i + needle.length);
  }
  return out;
}

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (EXTENSIONS.has(path.extname(entry.name))) yield full;
  }
}

if (!fs.existsSync(TARGET)) {
  console.error(`check-ui: ${TARGET} does not exist`);
  process.exit(2);
}

const hits = [];
for (const file of walk(TARGET)) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  lines.forEach((line, n) => {
    for (const rule of RULES) {
      for (const col of rule.test(line)) {
        hits.push({ file: path.relative(ROOT, file), line: n + 1, col: col + 1, rule, text: line.trim() });
      }
    }
  });
}

if (hits.length) {
  for (const h of hits) {
    console.log(`${h.file}:${h.line}:${h.col}  ${h.rule.name} (${h.rule.hint})`);
    console.log(`    ${h.text.slice(0, 160)}`);
  }
  console.log(`\ncheck-ui: ${hits.length} problem(s) in ${new Set(hits.map((h) => h.file)).size} file(s)`);
  process.exit(1);
}
console.log("check-ui: ok");
