import Link from "next/link";
import { PageSheetEnd } from "@/components/marketing/page-sheet";
import { JsonLd } from "@/components/seo/JsonLd";
import { ButtonLink } from "@/components/ui/button";
import { ArticleCta } from "@/components/marketing/article-cta";
import { coverTitle, crumbsFor, formatDate, guideCover } from "@/components/marketing/article-utils";
import { GuideBrowser, type GuideItem } from "@/components/marketing/guide-browser";
import { CoverArt } from "@/components/marketing/post-card";
import { breadcrumbList, graph } from "@/lib/jsonld";
import { listMdx, readingTime } from "@/lib/mdx";
import { getPage, isLive } from "@/lib/registry";
import { pageMetadata } from "@/lib/seo";
import "@/styles/prose.css";

/*
 * Guides index (kit pages/blogs.md): compact left-aligned title, one featured
 * guide (16:9 cover left, hairline-framed text panel right, ink pill), the
 * topic filter pills and a 4-column grid of cover cards, then the CTA band.
 */

const PATH = "/guides";
const FALLBACK = {
  title: "Guides: MongoDB, Sheets and AI data analysis",
  description:
    "Practical guides to querying MongoDB in plain English, aggregation pipelines, read-only access, Google Sheets and documents, and using AI on your data safely.",
};
/** The guide shown in the featured slot. Falls back to the newest. */
const FEATURED = "query-mongodb-in-plain-english";
const TAG_ORDER = ["MongoDB", "Google Sheets", "Documents", "AI and data", "Security"];

export const metadata = pageMetadata(PATH, getPage(PATH) ? {} : FALLBACK);

export default function GuidesIndex() {
  const guides = listMdx("guides").filter((d) => isLive(d.path));
  const featured = guides.find((g) => g.slug === FEATURED) ?? guides[0];
  // Grid: P0 guides first, then by most recent update, then title.
  const rest = guides
    .filter((g) => g !== featured)
    .sort(
      (a, b) =>
        a.meta.priority.localeCompare(b.meta.priority) ||
        (b.meta.updated ?? b.meta.date).localeCompare(a.meta.updated ?? a.meta.date) ||
        a.meta.title.localeCompare(b.meta.title),
    );

  const items: GuideItem[] = rest.map((g) => ({
    href: g.path,
    title: (g.meta.h1 ?? g.meta.title).replace(/\n/g, " "),
    coverLabel: coverTitle(g.meta, g.slug),
    cover: guideCover(g.slug),
    tag: g.meta.tags[0] ?? "Guide",
    meta: [formatDate(g.meta.updated ?? g.meta.date), g.meta.tags[0] ?? "Guide"],
  }));
  const present = new Set(items.map((i) => i.tag));
  const tags = [...TAG_ORDER.filter((t) => present.has(t)), ...[...present].filter((t) => !TAG_ORDER.includes(t))];

  return (
    <>
      <JsonLd data={graph(breadcrumbList(crumbsFor(PATH)))} />
      <div>
        <section className="container flex flex-col gap-8 pt-28 md:gap-10 md:pt-36">
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-[28px] leading-[1.2] font-medium tracking-heading text-tx md:text-[32px] lg:text-[36px]">
              Guides
            </h1>
            <p className="text-body leading-[1.65] text-tx-tertiary md:text-body-lg">
              Practical, tested how-tos for MongoDB, Google Sheets and documents, and for putting AI on your data safely.
            </p>
          </div>

          <div className="flex flex-col gap-12 md:gap-16">
            {featured ? (
              <article className="group flex flex-col gap-6 md:flex-row md:items-stretch">
                <Link
                  href={featured.path}
                  tabIndex={-1}
                  aria-hidden="true"
                  className="block overflow-hidden rounded-lg border border-st-secondary transition-colors duration-200 group-hover:border-st md:w-[58%] lg:w-[60%] [&_img]:transition-transform [&_img]:duration-500 group-hover:[&_img]:scale-[1.02]"
                >
                  <CoverArt
                    src={guideCover(featured.slug)}
                    label={coverTitle(featured.meta, featured.slug)}
                    size="lg"
                    sizes="(min-width: 1024px) 720px, (min-width: 768px) 58vw, 88vw"
                    preload
                  />
                </Link>
                <div className="flex flex-col border-y border-st-secondary py-8 md:w-[42%] md:py-10 lg:py-12">
                  <div className="flex flex-1 flex-col md:pl-4">
                    <h2 className="line-clamp-2 text-heading-card leading-[1.2] font-medium tracking-heading text-tx transition-colors duration-200 group-hover:text-indigo-800 md:text-heading-3 lg:text-[28px]">
                      <Link href={featured.path} className="focus-visible:outline-offset-4">
                        {(featured.meta.h1 ?? featured.meta.title).replace(/\n/g, " ")}
                      </Link>
                    </h2>
                    <p className="mt-3 line-clamp-3 text-body leading-[1.45] text-tx-secondary md:text-body-lg">
                      {featured.meta.description}
                    </p>
                    <p className="mt-4 flex flex-wrap items-center gap-2 text-caption text-tx-tertiary md:text-body">
                      <span>{formatDate(featured.meta.updated ?? featured.meta.date)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{featured.meta.tags[0] ?? "Guide"}</span>
                      <span aria-hidden="true">·</span>
                      <span>{readingTime(featured.raw)} min read</span>
                    </p>
                    <div className="mt-auto pt-8">
                      <ButtonLink href={featured.path} variant="ink" aria-label={`Read the guide: ${featured.meta.title}`}>
                        Read the guide
                      </ButtonLink>
                    </div>
                  </div>
                </div>
              </article>
            ) : null}

            {items.length ? <GuideBrowser items={items} tags={tags} /> : null}
          </div>
        </section>
        <ArticleCta className="mt-16 md:mt-24" />
      </div>
      <PageSheetEnd />
    </>
  );
}
