/**
 * MDX content listing for guides, docs, changelog and legal pages.
 *
 * Each file declares `export const metadata = { ... }` (MDX has no
 * frontmatter in Next 16). The object must be a plain literal: it is read
 * from the source with a string-aware scanner and parsed with JSON5, so it
 * works in server components, metadata routes and route handlers at build
 * time without importing the compiled MDX.
 *
 * Files starting with "_" (e.g. _example.mdx) are only listed outside
 * production builds.
 */

import fs from "node:fs";
import path from "node:path";
import JSON5 from "json5";
import GithubSlugger from "github-slugger";
import type { MdxDir, MdxMeta, Status } from "@/content/types";
import { authors } from "@/content/authors";
import { LAUNCH_PRIORITIES, shipped } from "@/lib/site";

export const MDX_DIRS: readonly MdxDir[] = ["guides", "docs", "changelog", "legal"];

/** URL prefix for each content directory. A file "foo.mdx" in guides is served at /guides/foo. */
export const MDX_ROUTES: Record<MdxDir, string> = {
  guides: "/guides",
  docs: "/docs",
  changelog: "/changelog",
  legal: "",
};

export interface MdxDoc {
  dir: MdxDir;
  slug: string;
  /** Site path, e.g. /guides/foo. */
  path: string;
  /** Source file relative to src/content, e.g. guides/foo.mdx. */
  file: string;
  meta: MdxMeta;
  /** Full file contents. */
  raw: string;
  /** Markdown body with top-level import/export statements removed. */
  body: string;
}

export interface TocItem {
  depth: 2 | 3;
  text: string;
  id: string;
}

const CONTENT_ROOT = () => path.join(process.cwd(), "src/content");
const isProd = () => process.env.NODE_ENV === "production";
const cache = new Map<MdxDir, MdxDoc[]>();

/** Lists and validates every .mdx file in src/content/<dir>, sorted newest first (docs by order). */
export function listMdx(dir: MdxDir): MdxDoc[] {
  if (isProd() && cache.has(dir)) return cache.get(dir)!;

  const abs = path.join(CONTENT_ROOT(), dir);
  let names: string[] = [];
  try {
    names = fs.readdirSync(abs).filter((n) => n.endsWith(".mdx"));
  } catch {
    names = [];
  }

  const docs = names
    .filter((n) => !(isProd() && n.startsWith("_")))
    .map((name): MdxDoc => {
      const file = `${dir}/${name}`;
      const raw = fs.readFileSync(path.join(abs, name), "utf8");
      const meta = parseMetadata(raw, file);
      assertMeta(meta, file);
      const slug = name.replace(/\.mdx$/, "");
      return {
        dir,
        slug,
        path: `${MDX_ROUTES[dir]}/${slug}`,
        file,
        meta,
        raw,
        body: stripEsm(raw),
      };
    })
    .sort((a, b) =>
      dir === "docs"
        ? (a.meta.order ?? 999) - (b.meta.order ?? 999) || a.slug.localeCompare(b.slug)
        : b.meta.date.localeCompare(a.meta.date) || a.slug.localeCompare(b.slug)
    );

  cache.set(dir, docs);
  return docs;
}

/** One MDX document by slug, or undefined. */
export function getMdx(dir: MdxDir, slug: string): MdxDoc | undefined {
  return listMdx(dir).find((d) => d.slug === slug);
}

/* ------------------------------------------------------------------ */
/* Metadata parsing                                                    */
/* ------------------------------------------------------------------ */

const EXPORT_RE = /^export\s+const\s+metadata\s*(?::[^=]+)?=\s*/;

/** Extracts and parses the `export const metadata = {...}` literal. Throws when missing or invalid. */
export function parseMetadata(raw: string, file = "<mdx>"): unknown {
  const start = findMetadataStart(raw);
  if (start < 0) throw new Error(`[mdx] ${file}: missing "export const metadata = { ... }"`);
  const end = matchBrace(raw, start);
  if (end < 0) throw new Error(`[mdx] ${file}: unterminated metadata object`);
  const literal = raw.slice(start, end + 1);
  try {
    return JSON5.parse(literal);
  } catch (err) {
    throw new Error(
      `[mdx] ${file}: metadata must be a plain object literal (no expressions). ${(err as Error).message}`
    );
  }
}

/** Offset of the "{" that opens the metadata literal, ignoring fenced code blocks. */
function findMetadataStart(raw: string): number {
  let offset = 0;
  let fence: string | null = null;
  for (const line of raw.split("\n")) {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1];
      else if (fenceMatch[1].startsWith(fence)) fence = null;
    } else if (!fence) {
      const m = line.match(EXPORT_RE);
      if (m) {
        const brace = raw.indexOf("{", offset + m[0].length);
        return brace;
      }
    }
    offset += line.length + 1;
  }
  return -1;
}

/** Index of the brace matching raw[start], skipping strings and comments. */
function matchBrace(raw: string, start: number): number {
  let depth = 0;
  for (let i = start; i < raw.length; i++) {
    const c = raw[i];
    if (c === '"' || c === "'" || c === "`") {
      i = skipString(raw, i, c);
      continue;
    }
    if (c === "/" && raw[i + 1] === "/") {
      const nl = raw.indexOf("\n", i);
      i = nl < 0 ? raw.length : nl;
      continue;
    }
    if (c === "/" && raw[i + 1] === "*") {
      const close = raw.indexOf("*/", i + 2);
      i = close < 0 ? raw.length : close + 1;
      continue;
    }
    if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function skipString(raw: string, i: number, quote: string): number {
  for (let j = i + 1; j < raw.length; j++) {
    if (raw[j] === "\\") {
      j++;
      continue;
    }
    if (raw[j] === quote) return j;
  }
  return raw.length;
}

/** Removes top-level ESM (import/export statements, including multi-line literals). */
function stripEsm(raw: string): string {
  const lines = raw.split("\n");
  const out: string[] = [];
  let fence: string | null = null;
  let offset = 0;
  let skipUntil = -1;
  for (const line of lines) {
    const lineStart = offset;
    offset += line.length + 1;
    if (lineStart <= skipUntil) continue;
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1];
      else if (fenceMatch[1].startsWith(fence)) fence = null;
      out.push(line);
      continue;
    }
    if (!fence && /^(import|export)\s/.test(line)) {
      // Skip the whole statement, including multi-line object literals.
      const open = line.search(/[{[]/);
      if (open >= 0) skipUntil = matchBrace(raw, lineStart + open);
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

const STATUSES: readonly Status[] = ["draft", "review", "published"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/;

/** Throws when metadata is structurally invalid. Warns in dev on length rules. */
export function assertMeta(meta: unknown, file = "<mdx>"): asserts meta is MdxMeta {
  const errors: string[] = [];
  const m = (meta ?? {}) as Record<string, unknown>;
  const str = (k: string, optional = false) => {
    if (m[k] === undefined && optional) return;
    if (typeof m[k] !== "string" || !(m[k] as string).trim()) errors.push(`${k} must be a non-empty string`);
  };
  const strArr = (k: string, optional = false) => {
    if (m[k] === undefined && optional) return;
    if (!Array.isArray(m[k]) || !(m[k] as unknown[]).every((v) => typeof v === "string"))
      errors.push(`${k} must be an array of strings`);
  };

  if (typeof meta !== "object" || meta === null || Array.isArray(meta)) {
    throw new Error(`[mdx] ${file}: metadata must be an object`);
  }
  str("title");
  str("description");
  str("h1", true);
  str("primaryKeyword");
  str("author");
  str("cover", true);
  str("group", true);
  str("navLabel", true);
  strArr("tags");
  strArr("related", true);
  if (typeof m.date !== "string" || !ISO_DATE.test(m.date)) errors.push("date must be an ISO date (YYYY-MM-DD)");
  if (m.updated !== undefined && (typeof m.updated !== "string" || !ISO_DATE.test(m.updated)))
    errors.push("updated must be an ISO date (YYYY-MM-DD)");
  if (!STATUSES.includes(m.status as Status)) errors.push(`status must be one of ${STATUSES.join(", ")}`);
  if (!(LAUNCH_PRIORITIES as readonly string[]).includes(m.priority as string))
    errors.push(`priority must be one of ${LAUNCH_PRIORITIES.join(", ")}`);
  if (m.order !== undefined && typeof m.order !== "number") errors.push("order must be a number");
  if (m.requires !== undefined && !(String(m.requires) in shipped))
    errors.push(`requires must be one of ${Object.keys(shipped).join(", ")}`);
  if (typeof m.author === "string" && !(m.author in authors))
    errors.push(`author "${m.author}" is not in src/content/authors.ts`);
  if (m.related !== undefined && Array.isArray(m.related) && m.related.some((p) => !String(p).startsWith("/")))
    errors.push("related entries must be site paths starting with /");

  if (errors.length) throw new Error(`[mdx] ${file}: invalid metadata\n  - ${errors.join("\n  - ")}`);

  if (!isProd()) {
    const title = String(m.title);
    const description = String(m.description);
    if (title.length > 52) console.warn(`[mdx] ${file}: title is ${title.length} chars (max 52)`);
    if (description.length < 110 || description.length > 160)
      console.warn(`[mdx] ${file}: description is ${description.length} chars (want 110 to 160)`);
  }
}

/* ------------------------------------------------------------------ */
/* Table of contents and reading time                                  */
/* ------------------------------------------------------------------ */

/** Plain text of a markdown heading, matching what rehype-slug sees (hast text content). */
function headingText(md: string): string {
  return md
    .replace(/\s+#+\s*$/, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/(^|[^\w])_(.+?)_(?=[^\w]|$)/g, "$1$2")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/\\([\\`*_{}[\]()#+\-.!|<>~])/g, "$1")
    .trim();
}

/**
 * ## and ### headings with ids identical to rehype-slug's.
 * Every heading level feeds the slugger (as rehype-slug does), so duplicate
 * headings get the same -1, -2 suffixes.
 */
export function toc(raw: string): TocItem[] {
  const slugger = new GithubSlugger();
  const items: TocItem[] = [];
  let fence: string | null = null;
  for (const line of stripEsm(raw).split("\n")) {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1];
      else if (fenceMatch[1].startsWith(fence)) fence = null;
      continue;
    }
    if (fence) continue;
    const m = line.match(/^ {0,3}(#{1,6})\s+(.+)$/);
    if (!m) continue;
    const text = headingText(m[2]);
    const id = slugger.slug(text);
    const depth = m[1].length;
    if (depth === 2 || depth === 3) items.push({ depth, text, id });
  }
  return items;
}

/** Minutes to read at 230 words per minute, at least 1. */
export function readingTime(raw: string): number {
  const text = stripEsm(raw)
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_`~|[\]()-]/g, " ");
  const words = text.split(/\s+/).filter((w) => /\w/.test(w)).length;
  return Math.max(1, Math.round(words / 230));
}
