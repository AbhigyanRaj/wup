import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { CtaBand } from "@/components/marketing/cta-band";
import { FaqSection } from "@/components/marketing/faq";
import { HeroCompact } from "@/components/marketing/hero-compact";
import { InnerSheet, PageSheetEnd } from "@/components/marketing/page-sheet";
import { JsonLd } from "@/components/seo/JsonLd";
import { ButtonLink } from "@/components/ui/button";
import { SectionHead } from "@/components/ui/section";
import { alternatives } from "@/content/data/alternatives";
import type { AlternativesPage } from "@/content/types";
import { breadcrumbList, graph } from "@/lib/jsonld";
import { isLive } from "@/lib/registry";
import { SIGNUP } from "@/lib/site";
import { cn } from "@/lib/cn";
import { LinkColumns, liveLinks, ProseSplit, SourcesList, crumbsFor } from "./shared";

const BANNERS = ["from-[#e8effc]", "from-[#e0f2fe]", "from-[#ede9fe]", "from-[#dbeafe]"];

export function AlternativesTemplate({ page }: { page: AlternativesPage }) {
  return (
    <>
      <JsonLd data={graph(breadcrumbList(crumbsFor(page.path)))} />
      <InnerSheet>
        <HeroCompact
          eyebrow="Alternatives"
          title={page.h1}
          lead={page.lead}
          actions={
            <>
              <ButtonLink href="#picks" variant="hero-primary">
                See the {page.picks.length} picks
              </ButtonLink>
              <ButtonLink href={SIGNUP} variant="hero-outline">
                Try wuup free
              </ButtonLink>
            </>
          }
        />

        <section className="container section -mt-8 md:-mt-12" aria-label="How we compared">
          <div className="flex w-full flex-col items-center gap-4 rounded-2xl border border-st-secondary bg-sf-white p-6 md:flex-row md:p-8">
            <p className="shrink-0 font-mono text-label uppercase tracking-[0.12em] text-tx-tertiary">How we compared</p>
            <ul className="m-0 flex list-none flex-wrap justify-center gap-2 p-0 md:justify-start">
              {page.criteria.map((c) => (
                <li key={c} className="rounded-full border border-st bg-sf-secondary px-3.5 py-1.5 text-caption text-tx-secondary">
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="picks" className="container section scroll-mt-24" aria-label="Alternatives">
          <SectionHead title={`${page.target.name} alternatives,\nchosen by job`} intro="Each pick is best at something different. Facts come from each vendor's own pages; see the sources at the end." />
          <ol className="m-0 flex w-full list-none flex-col gap-4 p-0">
            {page.picks.map((p, i) => (
              <li key={p.name}>
                <article className={cn("grid overflow-hidden rounded-2xl border bg-sf-white md:grid-cols-[280px_1fr]", i === 0 ? "border-indigo-200" : "border-st-secondary")}>
                  <div className={cn("flex flex-col justify-between gap-6 bg-gradient-to-br to-white p-6 md:p-8", BANNERS[i % BANNERS.length])}>
                    <span className="font-mono text-caption text-tx-tertiary tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                    <div>
                      <h3 className="text-heading-3 font-medium tracking-card text-tx">{p.name}</h3>
                      <p className="mt-1 text-caption text-tx-secondary">Best for: {p.bestFor}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-5 p-6 md:p-8">
                    <p className="text-body leading-[1.7] text-tx-secondary">{p.summary}</p>
                    <div className="mt-auto flex flex-wrap items-center gap-3">
                      {p.name === "wuup" ? (
                        <ButtonLink href={SIGNUP} variant="ink" size="sm" arrow>
                          Start free
                        </ButtonLink>
                      ) : (
                        <a href={p.url} target="_blank" rel="noopener noreferrer nofollow" className="btn btn--soft btn--sm gap-1.5">
                          Visit {p.name} <ArrowUpRight className="size-3.5" aria-hidden="true" />
                        </a>
                      )}
                      {p.comparePath && isLive(p.comparePath) ? (
                        <Link href={p.comparePath} className="inline-flex items-center gap-1 text-caption text-indigo-700 hover:text-indigo-900">
                          Full comparison <ArrowRight className="size-3.5" aria-hidden="true" />
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ol>
        </section>

        <section className="container section" aria-label="Choosing">
          <SectionHead title={"How to choose"} />
          <ProseSplit sections={page.sections} />
          <div className="w-full">
            <SourcesList sources={page.sources} verifiedOn={page.verifiedOn} />
          </div>
        </section>

        <section className="container section" aria-label="Related">
          <SectionHead title={"Related"} />
          <LinkColumns
            columns={[
              { title: "Comparisons", links: liveLinks([...page.related.filter((r) => r.startsWith("/compare")), "/compare"]) },
              { title: "More alternatives", links: liveLinks(alternatives.map((a) => a.path).filter((p) => p !== page.path)) },
              { title: "wuup", links: liveLinks([...page.related.filter((r) => !r.startsWith("/compare")), "/chat-with-mongodb", "/pricing"]) },
              { title: "Free tools", links: liveLinks(["/tools/mongodb-query-generator", "/tools/sql-to-mongodb-converter"]) },
            ]}
          />
        </section>

        {page.faqs?.length ? <FaqSection items={page.faqs} /> : null}
        <CtaBand title={"Try the one built\nfor MongoDB and documents."} secondary={{ label: "All comparisons", href: "/compare" }} />
      </InnerSheet>
      <PageSheetEnd />
    </>
  );
}
