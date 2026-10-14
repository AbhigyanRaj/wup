import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Toc } from "@/components/docs/toc";
import { getAuthor } from "@/content/authors";
import { listMdx, readingTime, toc, type MdxDoc } from "@/lib/mdx";
import { isLive } from "@/lib/registry";
import { SIGNUP } from "@/lib/site";
import { ArticleCta } from "./article-cta";
import { coverTitle, crumbsFor, formatDate, guideCover } from "./article-utils";
import { Breadcrumbs } from "./breadcrumbs";
import { CoverArt } from "./post-card";
import { RelatedLinks } from "./related-links";
import { ShareButton } from "./share-button";
import "@/styles/prose.css";

/*
 * Article template (kit pages/blog-post.md), used for guides and changelog
 * entries. One centred 680px reading column:
 *   breadcrumb (14px #666) -> 42px display H1 (36 mobile, 525, lh 1.25)
 *   -> tag chips + "Try wuup free" ink pill -> hairline -> meta row
 *   (date · reading time · author, Share on the right) -> 16:9 cover (radius 6)
 *   -> prose (64px below) -> Related -> dusk CTA band.
 * At >=1280px an "On this page" rail sits in the right gutter when the
 * article has more than five H2s (the kit has no TOC; this is the docs TOC).
 */

export interface ArticleLayoutProps {
  doc: MdxDoc;
  children: ReactNode;
  variant?: "guide" | "changelog";
}

function H1Lines({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <span key={i}>
          {i > 0 ? <br className="hidden md:block" /> : null}
          {i > 0 ? " " : null}
          {line}
        </span>
      ))}
    </>
  );
}

export function ArticleLayout({ doc, children, variant = "guide" }: ArticleLayoutProps) {
  const { meta } = doc;
  const crumbs = crumbsFor(doc.path);
  const minutes = readingTime(doc.raw);
  const author = getAuthor(meta.author);
  const headings = toc(doc.raw);
  const h2s = headings.filter((h) => h.depth === 2);
  const showToc = h2s.length > 5;
  const cover = variant === "guide" ? guideCover(doc.slug) : null;
  const tags = variant === "changelog" ? (meta.tags.length ? meta.tags : ["Release"]) : meta.tags.slice(0, 3);

  return (
    <article id="top" className="pb-8">
      <header className="mx-auto w-10/12 max-w-[680px] pt-28 md:w-full md:pt-36">
        <Breadcrumbs items={crumbs} className="mb-6" />
        <h1 className="mb-3.5 font-display text-[36px] leading-[1.2] font-medium tracking-[-0.015em] text-balance text-tx md:text-[42px] md:leading-[1.25]">
          <H1Lines text={meta.h1 ?? meta.title} />
        </h1>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <ul className="flex flex-wrap gap-2 max-sm:[&>li:nth-child(n+2)]:hidden" aria-label="Tags">
            {tags.map((t) => (
              <li key={t} className="rounded-full bg-sf-secondary px-3 py-1 text-label text-tx-tertiary">
                {t}
              </li>
            ))}
          </ul>
          <ButtonLink href={SIGNUP} variant="ink" size="sm">
            Try wuup free
          </ButtonLink>
        </div>
        <hr className="mb-4 border-st" />
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-caption text-tx-tertiary">
          <p className="flex flex-wrap items-center gap-2.5">
            <time dateTime={meta.updated ?? meta.date}>{formatDate(meta.updated ?? meta.date)}</time>
            <span aria-hidden="true">·</span>
            <span>{minutes} min read</span>
            <span aria-hidden="true" className="max-sm:hidden">·</span>
            <span className="max-sm:hidden">
              By{" "}
              <Link href={author.url} rel="author" className="transition-colors duration-150 hover:text-tx">
                {author.name}
              </Link>
            </span>
          </p>
          <ShareButton title={meta.title} url={doc.path} />
        </div>
        {variant === "guide" ? (
          <div className="mt-6 overflow-hidden rounded-md">
            <CoverArt
              src={cover}
              label={coverTitle(meta, doc.slug)}
              eyebrow="Guide"
              size="lg"
              sizes="(min-width: 768px) 680px, 84vw"
              preload
            />
          </div>
        ) : null}
      </header>

      <div className="relative">
        <div className="prose mx-auto w-10/12 max-w-[680px] pt-12 pb-16 md:w-full md:pt-16">{children}</div>
        {showToc ? (
          <aside className="absolute top-16 bottom-16 left-[calc(50%+340px+56px)] hidden w-[208px] xl:block">
            <div className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto pb-4">
              <Toc items={h2s} />
            </div>
          </aside>
        ) : null}
      </div>

      {variant === "changelog" ? <OtherReleases current={doc.path} /> : <RelatedLinks path={doc.path} />}
      <ArticleCta />
    </article>
  );
}

/* Changelog entries end with every other release, so each entry is linked from all the others. */
function OtherReleases({ current }: { current: string }) {
  const entries = listMdx("changelog").filter((d) => d.path !== current && isLive(d.path));
  if (!entries.length) return null;
  return (
    <section aria-labelledby="releases-heading" className="mx-auto w-10/12 max-w-[680px] pb-8 md:w-full">
      <div className="border-t border-st-secondary pt-12">
        <h2 id="releases-heading" className="mb-6 font-display text-heading-sub font-medium tracking-heading text-tx">
          More releases
        </h2>
        <ul className="flex flex-col divide-y divide-st-secondary">
          {entries.map((e) => (
            <li key={e.path}>
              <Link href={e.path} className="group flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:gap-6">
                <time dateTime={e.meta.date} className="shrink-0 text-caption text-tx-tertiary sm:w-32">
                  {formatDate(e.meta.date)}
                </time>
                <span className="text-body font-medium text-tx transition-colors duration-200 group-hover:text-indigo-800">
                  {e.meta.title}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-6">
          <Link href="/changelog" className="prose-link text-caption">
            See the full changelog
          </Link>
        </p>
      </div>
    </section>
  );
}
