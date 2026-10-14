import type { ReactNode } from "react";
import { Toc } from "@/components/docs/toc";
import { toc, type MdxDoc } from "@/lib/mdx";
import { formatDateLong } from "./article-utils";
import "@/styles/prose.css";

/*
 * Legal / long-form policy page (kit pages/legal.md): 160px top padding,
 * the kit container (1200px at 1440), a two-line display masthead
 * ("wuup" / document name, 32px / 135%, 525), an "Updated on" line in
 * #3d3d3d, a full-width hairline with 48px margins, then the prose stack
 * with anchorable sans H2s.
 * Deviation noted by the kit (legal.md 4): prose is capped at 72ch for
 * readability, and an "On this page" rail sits on the right at >=1280px
 * when the document has more than 8 H2s.
 */
export function LegalLayout({ doc, children }: { doc: MdxDoc; children: ReactNode }) {
  const { meta } = doc;
  const [line1, ...rest] = (meta.h1 ?? `wuup\n${meta.title}`).split("\n");
  const h2s = toc(doc.raw).filter((h) => h.depth === 2);
  const showToc = h2s.length > 8;

  return (
    <section id="top" className="container py-32 md:py-40">
      <header className="mb-12 flex flex-col gap-6">
        <h1 className="font-display text-[32px] leading-[1.35] font-medium text-tx">
          {line1}
          {rest.length ? (
            <>
              <br />
              {rest.join(" ")}
            </>
          ) : null}
        </h1>
        <p className="text-body leading-6 text-tx-secondary">
          Updated on: <time dateTime={meta.updated ?? meta.date}>{formatDateLong(meta.updated ?? meta.date)}</time>
        </p>
      </header>
      <hr className="mb-12 border-[#e5e5e5]" />
      <div className="xl:grid xl:grid-cols-[minmax(0,72ch)_1fr] xl:gap-16">
        <div className="prose prose--legal max-w-[72ch]">{children}</div>
        {showToc ? (
          <aside className="hidden xl:block">
            <div className="sticky top-28 ml-auto max-h-[calc(100vh-8rem)] w-[240px] overflow-y-auto">
              <Toc items={h2s} />
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
