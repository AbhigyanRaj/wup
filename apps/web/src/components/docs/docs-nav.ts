import { listMdx } from "@/lib/mdx";
import { isLive } from "@/lib/registry";

/*
 * Docs information architecture. Groups appear in this order; pages inside a
 * group follow their `order`. Pages whose `requires` flag has not shipped are
 * left out (isLive).
 */
export const DOCS_GROUPS = ["Get started", "Connect data", "Models", "Features", "Help"] as const;

export interface DocsNavItem {
  path: string;
  slug: string;
  label: string;
  title: string;
  description: string;
  group: string;
}

export interface DocsNavGroup {
  label: string;
  items: DocsNavItem[];
}

export function getDocsNav(): DocsNavGroup[] {
  const docs = listMdx("docs").filter((d) => isLive(d.path));
  const items: DocsNavItem[] = docs.map((d) => ({
    path: d.path,
    slug: d.slug,
    label: d.meta.navLabel ?? d.meta.title,
    title: d.meta.title,
    description: d.meta.description,
    group: d.meta.group ?? "Help",
  }));
  const known = DOCS_GROUPS as readonly string[];
  const extra = [...new Set(items.map((i) => i.group))].filter((g) => !known.includes(g));
  return [...known, ...extra]
    .map((label) => ({ label, items: items.filter((i) => i.group === label) }))
    .filter((g) => g.items.length > 0);
}

/** Flat reading order (for previous / next). */
export function docsSequence(): DocsNavItem[] {
  return getDocsNav().flatMap((g) => g.items);
}
