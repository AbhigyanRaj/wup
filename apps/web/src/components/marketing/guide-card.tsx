import type { PageEntry } from "@/content/types";
import { PostCard } from "./post-card";
import { coverTitle, formatDate, guideCover } from "./article-utils";

/*
 * A registry page as a post card. Guides use their generated cover at
 * /images/guides/<slug>.webp; other pages (tools, docs, connectors) get the
 * gradient fallback with a section eyebrow.
 */

const SECTION_EYEBROW: Partial<Record<PageEntry["section"], string>> = {
  guide: "Guide",
  docs: "Docs",
  tool: "Free tool",
  connector: "Connector",
  changelog: "Changelog",
  feature: "Feature",
  "use-case": "Use case",
  compare: "Compare",
  alternatives: "Alternatives",
  integration: "Integration",
  glossary: "Glossary",
  core: "wuup",
  legal: "Legal",
};

export function GuideCard({
  page,
  headingLevel = "h3",
  sizes,
  preload,
}: {
  page: PageEntry;
  headingLevel?: "h2" | "h3";
  sizes?: string;
  preload?: boolean;
}) {
  const slug = page.path.split("/").pop() ?? "";
  const cover = page.section === "guide" ? guideCover(slug) : null;
  const eyebrow = SECTION_EYEBROW[page.section] ?? "wuup";
  const meta = [
    page.date ? formatDate(page.date) : eyebrow,
    page.section === "guide" ? (page.tags?.[0] ?? "Guide") : page.date ? eyebrow : null,
  ].filter((m): m is string => !!m);
  return (
    <PostCard
      href={page.path}
      title={page.h1?.replace(/\n/g, " ") ?? page.title}
      coverLabel={coverTitle({ navLabel: page.navLabel, title: page.title }, slug)}
      cover={cover}
      eyebrow={eyebrow}
      meta={meta}
      headingLevel={headingLevel}
      sizes={sizes}
      preload={preload}
    />
  );
}
