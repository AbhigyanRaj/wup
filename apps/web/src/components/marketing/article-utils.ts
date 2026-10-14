import fs from "node:fs";
import path from "node:path";
import { breadcrumbsFor, getPage, type Crumb } from "@/lib/registry";

/*
 * Server helpers shared by the guide, docs, changelog and legal layouts.
 */

const SECTION_NAMES: Record<string, string> = {
  "/guides": "Guides",
  "/docs": "Docs",
  "/changelog": "Changelog",
};

/**
 * Breadcrumbs for a content path. Uses the registry, and fills in the section
 * index (Guides, Docs, Changelog) when it is not registered as a page yet.
 */
export function crumbsFor(path: string): Crumb[] {
  const crumbs = breadcrumbsFor(path);
  const section = "/" + path.split("/").filter(Boolean)[0];
  if (SECTION_NAMES[section] && path !== section && !crumbs.some((c) => c.path === section)) {
    crumbs.splice(1, 0, { name: getPage(section)?.navLabel ?? SECTION_NAMES[section], path: section });
  }
  if (SECTION_NAMES[path] && crumbs.length) crumbs[crumbs.length - 1].name = getPage(path)?.navLabel ?? SECTION_NAMES[path];
  return crumbs;
}

const coverCache = new Map<string, string | null>();

/** Public URL of /images/guides/<slug>.webp when the file exists, else null. */
export function guideCover(slug: string): string | null {
  if (coverCache.has(slug)) return coverCache.get(slug)!;
  const rel = `/images/guides/${slug}.webp`;
  const found = fs.existsSync(path.join(process.cwd(), "public", rel)) ? rel : null;
  coverCache.set(slug, found);
  return found;
}

/** "Oct 14, 2026" */
export function formatDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** "October 14, 2026" */
export function formatDateLong(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Short names set on guide cover art (the kit covers carry 1 to 3 words). */
const COVER_LABELS: Record<string, string> = {
  "query-mongodb-in-plain-english": "Plain-English MongoDB",
  "mongodb-aggregation-pipeline-examples": "15 pipelines",
  "mongodb-read-only-user": "Read-only user",
  "connect-mongodb-to-chatgpt-or-claude": "MongoDB meets chat",
  "sql-to-mongodb-cheat-sheet": "SQL to MongoDB",
  "chat-with-google-sheets-methods": "Chat with Sheets",
  "ask-questions-across-pdfs-and-spreadsheets": "PDFs + Sheets",
  "why-ai-data-answers-hallucinate": "Grounded answers",
  "text-to-sql-vs-text-to-mongodb": "Text to query",
  "best-ai-data-analyst-tools": "AI data analysts",
  "byok-explained": "Bring your own key",
  "is-it-safe-to-connect-database-to-ai": "Is it safe?",
  "infer-mongodb-schema-from-documents": "Schema from documents",
};

/** A short label for cover art: a curated cover name, the nav label, or the title before a colon. */
export function coverTitle(meta: { navLabel?: string; title: string }, slug?: string): string {
  if (slug && COVER_LABELS[slug]) return COVER_LABELS[slug];
  if (meta.navLabel) return meta.navLabel;
  return meta.title.split(/:\s/)[0];
}
