import type { ComponentPropsWithoutRef } from "react";
import Link from "next/link";
import { PageSheetEnd } from "@/components/marketing/page-sheet";
import { JsonLd } from "@/components/seo/JsonLd";
import { ArticleCta } from "@/components/marketing/article-cta";
import { crumbsFor, formatDateLong } from "@/components/marketing/article-utils";
import { breadcrumbList, graph } from "@/lib/jsonld";
import { listMdx } from "@/lib/mdx";
import { getPage, isLive } from "@/lib/registry";
import { pageMetadata } from "@/lib/seo";
import "@/styles/prose.css";

/*
 * Changelog: every entry inline, newest first. Compact left-aligned title
 * (blogs.md 2.1), then one row per release: a sticky date rail on the left
 * and the entry (title, tag, prose) in a 680px column, divided by hairlines.
 */

const PATH = "/changelog";
const FALLBACK = {
  title: "Changelog: what's new in wuup",
  description:
    "Every wuup release in one place: the MongoDB bridge, document answers with citations, bring your own key, streaming answers, web search and security fixes.",
};

export const metadata = pageMetadata(PATH, getPage(PATH) ? {} : FALLBACK);

/* Entry headings sit one level below the entry title and carry no ids (they repeat across entries). */
function EntryH3(props: ComponentPropsWithoutRef<"h3">) {
  return <h3 {...props} id={undefined} />;
}
function EntryH4(props: ComponentPropsWithoutRef<"h4">) {
  return <h4 {...props} id={undefined} />;
}

export default async function ChangelogPage() {
  const entries = listMdx("changelog").filter((d) => isLive(d.path));
  const rendered = await Promise.all(
    entries.map(async (e) => ({ doc: e, Content: (await import(`@/content/changelog/${e.slug}.mdx`)).default })),
  );

  return (
    <>
      <JsonLd data={graph(breadcrumbList(crumbsFor(PATH)))} />
      <div>
        <section className="container pt-28 md:pt-36">
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-[28px] leading-[1.2] font-medium tracking-heading text-tx md:text-[32px] lg:text-[36px]">
              Changelog
            </h1>
            <p className="text-body leading-[1.65] text-tx-tertiary md:text-body-lg">
              What changed in wuup, release by release. Built from the commit history.
            </p>
          </div>

          <ol className="mt-12 flex flex-col md:mt-16">
            {rendered.map(({ doc, Content }) => (
              <li
                key={doc.slug}
                id={doc.slug}
                className="grid scroll-mt-28 grid-cols-1 gap-4 border-t border-st-secondary py-12 md:grid-cols-[200px_minmax(0,680px)] md:gap-16 md:py-16"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-3 md:sticky md:top-28 md:flex-col md:items-start md:gap-2">
                    <time dateTime={doc.meta.date} className="text-caption text-tx-tertiary md:text-body">
                      {formatDateLong(doc.meta.date)}
                    </time>
                    <span className="rounded-full bg-sf-secondary px-3 py-1 text-label text-tx-tertiary">
                      {doc.meta.tags[0] ?? "Release"}
                    </span>
                  </div>
                </div>
                <article className="min-w-0">
                  <h2 className="mb-5 text-heading-3 leading-[1.25] font-semibold tracking-[-0.01em] text-balance text-tx md:text-[28px]">
                    <Link href={doc.path} className="transition-colors duration-200 hover:text-indigo-800">
                      {doc.meta.h1?.replace(/\n/g, " ") ?? doc.meta.title}
                    </Link>
                  </h2>
                  <div className="prose prose--changelog">
                    <Content components={{ h2: EntryH3, h3: EntryH4 }} />
                  </div>
                </article>
              </li>
            ))}
          </ol>
        </section>
        <ArticleCta className="mt-8" title={"Try what shipped.\nAsk your data a question."} />
      </div>
      <PageSheetEnd />
    </>
  );
}
