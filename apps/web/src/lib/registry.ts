/**
 * Page registry: one flat list of every marketing page, built from the data
 * modules in src/content/data and the MDX files in src/content/<dir>.
 *
 * Published = status "published", its `requires` flag has shipped, and its
 * priority is in LAUNCH_PRIORITIES. With NEXT_PUBLIC_SHOW_DRAFTS=1, draft and
 * review pages are included too (for previews and local work).
 */

import type { DataPage, MdxDir, OgTemplate, PageEntry, Section } from "@/content/types";
import { corePages } from "@/content/data/core-pages";
import { features } from "@/content/data/features";
import { connectors } from "@/content/data/connectors";
import { useCases } from "@/content/data/use-cases";
import { comparisons } from "@/content/data/compare";
import { alternatives } from "@/content/data/alternatives";
import { integrations } from "@/content/data/integrations";
import { glossary } from "@/content/data/glossary";
import { tools } from "@/content/data/tools";
import { listMdx, MDX_DIRS } from "@/lib/mdx";
import { LAUNCH_PRIORITIES, shipped } from "@/lib/site";

const KIND_TO_SECTION: Record<DataPage["kind"], Section> = {
  core: "core",
  connector: "connector",
  tool: "tool",
  compare: "compare",
  alternatives: "alternatives",
  "use-case": "use-case",
  feature: "feature",
  integration: "integration",
  glossary: "glossary",
};

const MDX_SECTION: Record<MdxDir, Section> = {
  guides: "guide",
  docs: "docs",
  changelog: "changelog",
  legal: "legal",
};

const MDX_OG: Record<MdxDir, { template: OgTemplate; eyebrow: string }> = {
  guides: { template: "guide", eyebrow: "Guide" },
  docs: { template: "docs", eyebrow: "Docs" },
  changelog: { template: "default", eyebrow: "Changelog" },
  legal: { template: "legal", eyebrow: "Legal" },
};

const isProd = () => process.env.NODE_ENV === "production";
export const showDrafts = () => process.env.NEXT_PUBLIC_SHOW_DRAFTS === "1";

function fromData(page: DataPage): PageEntry {
  return {
    path: page.path,
    title: page.title,
    description: page.description,
    section: KIND_TO_SECTION[page.kind],
    status: page.status,
    priority: page.priority,
    updated: page.updated,
    og: page.og,
    related: page.related,
    navLabel: page.navLabel,
    h1: page.h1,
    requires: page.requires,
    primaryKeyword: page.primaryKeyword,
  };
}

function fromMdx(dir: MdxDir): PageEntry[] {
  return listMdx(dir).map((doc) => {
    const { meta } = doc;
    return {
      path: doc.path,
      title: meta.title,
      description: meta.description,
      section: MDX_SECTION[dir],
      status: meta.status,
      priority: meta.priority,
      updated: meta.updated ?? meta.date,
      og: { ...MDX_OG[dir], ...meta.og },
      related: meta.related ?? [],
      navLabel: meta.navLabel,
      h1: meta.h1,
      requires: meta.requires,
      primaryKeyword: meta.primaryKeyword,
      date: meta.date,
      author: meta.author,
      tags: meta.tags,
      source: doc.file,
    };
  });
}

let allCache: PageEntry[] | null = null;

/** Every page, any status. Paths are unique; duplicates throw. */
export function getAllPages(): PageEntry[] {
  if (allCache && isProd()) return allCache;

  const dataPages: DataPage[] = [
    ...corePages,
    ...features,
    ...connectors,
    ...useCases,
    ...comparisons,
    ...alternatives,
    ...integrations,
    ...glossary,
    ...tools,
  ];
  const pages = [...dataPages.map(fromData), ...MDX_DIRS.flatMap(fromMdx)];

  const seen = new Set<string>();
  for (const p of pages) {
    if (seen.has(p.path)) throw new Error(`[registry] duplicate path ${p.path}`);
    seen.add(p.path);
    if (p.path !== "/" && (!p.path.startsWith("/") || p.path.endsWith("/")))
      throw new Error(`[registry] path must start with / and have no trailing slash: ${p.path}`);
  }
  if (!isProd()) validateDev(dataPages);

  allCache = pages;
  return pages;
}

/** Whether a page is live under the current flags and env. */
export function isPublished(page: PageEntry): boolean {
  const statusOk = page.status === "published" || showDrafts();
  const shippedOk = !page.requires || shipped[page.requires];
  const priorityOk = (LAUNCH_PRIORITIES as readonly string[]).includes(page.priority);
  return statusOk && shippedOk && priorityOk;
}

/** Pages that render, appear in the sitemap, nav and llms.txt. */
export function getPublishedPages(): PageEntry[] {
  return getAllPages().filter(isPublished);
}

/** Any page by path (published or not), or undefined. */
export function getPage(path: string): PageEntry | undefined {
  return getAllPages().find((p) => p.path === path);
}

/** Whether a path is a published page. */
export function isLive(path: string): boolean {
  const page = getPage(path);
  return !!page && isPublished(page);
}

/**
 * Up to n published pages related to `path`: its declared `related` list
 * first, then other pages from the same section, newest first.
 */
export function getRelated(path: string, n = 3): PageEntry[] {
  const page = getPage(path);
  if (!page) return [];
  const published = getPublishedPages();
  const byPath = new Map(published.map((p) => [p.path, p]));
  const out: PageEntry[] = [];
  const add = (p: PageEntry | undefined) => {
    if (p && p.path !== path && !out.includes(p) && out.length < n) out.push(p);
  };
  page.related.forEach((r) => add(byPath.get(r)));
  published
    .filter((p) => p.section === page.section)
    .sort((a, b) => b.updated.localeCompare(a.updated))
    .forEach(add);
  return out;
}

export interface Crumb {
  name: string;
  path: string;
}

/**
 * Home, then every registered ancestor path, then the page itself.
 * "/guides/foo" gives Home > Guides > Foo when "/guides" is registered.
 */
export function breadcrumbsFor(path: string): Crumb[] {
  const crumbs: Crumb[] = [{ name: "Home", path: "/" }];
  if (path === "/") return crumbs;
  const parts = path.split("/").filter(Boolean);
  for (let i = 1; i <= parts.length; i++) {
    const p = "/" + parts.slice(0, i).join("/");
    const page = getPage(p);
    if (page) crumbs.push({ name: page.navLabel ?? page.title, path: p });
    else if (i === parts.length) crumbs.push({ name: titleCase(parts[i - 1]), path: p });
  }
  return crumbs;
}

const titleCase = (slug: string) =>
  slug.replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/* ------------------------------------------------------------------ */
/* Dev-only content checks                                             */
/* ------------------------------------------------------------------ */

let validated = false;

function validateDev(pages: DataPage[]) {
  if (validated) return;
  validated = true;
  const warn = (path: string, msg: string) => console.warn(`[registry] ${path}: ${msg}`);
  for (const p of pages) {
    if (p.title.length > 52) warn(p.path, `title is ${p.title.length} chars (max 52)`);
    if (p.description.length < 110 || p.description.length > 160)
      warn(p.path, `description is ${p.description.length} chars (want 110 to 160)`);
    if (p.kind === "connector" && p.exampleQuestions.length !== 8)
      warn(p.path, `connector has ${p.exampleQuestions.length} example questions (want 8)`);
    if (p.kind === "tool" && p.examples.length < 10)
      warn(p.path, `tool has ${p.examples.length} examples (want at least 10)`);
  }
}
