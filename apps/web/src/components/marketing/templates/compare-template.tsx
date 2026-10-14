import { ArrowUpRight, Scale } from "lucide-react";
import { CompareTable } from "@/components/marketing/compare-table";
import { CtaBand } from "@/components/marketing/cta-band";
import { FaqSection } from "@/components/marketing/faq";
import { HeroCompact } from "@/components/marketing/hero-compact";
import { InnerSheet, PageSheetEnd } from "@/components/marketing/page-sheet";
import { JsonLd } from "@/components/seo/JsonLd";
import { ButtonLink } from "@/components/ui/button";
import { SectionHead } from "@/components/ui/section";
import { alternatives } from "@/content/data/alternatives";
import { comparisons, type ComparePageFull } from "@/content/data/compare";
import { breadcrumbList, graph } from "@/lib/jsonld";

import { SIGNUP } from "@/lib/site";
import { CheckItems, LinkColumns, liveLinks, ProseSplit, SourcesList, crumbsFor } from "./shared";

export function VerdictCards({ wuup, them, themName }: { wuup: string[]; them: string[]; themName: string }) {
  return (
    <div className="grid w-full gap-4 md:grid-cols-2">
      <article className="relative flex flex-col gap-6 overflow-hidden rounded-2xl border border-indigo-200 bg-sf-white p-6 md:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-[radial-gradient(circle,#c7d7fe_0%,transparent_70%)]" />
        <div className="relative flex flex-col gap-1.5">
          <p className="text-caption font-medium text-tx-tertiary">Choose wuup if</p>
          <h3 className="text-heading-3 font-medium tracking-card text-tx">Your data lives in MongoDB, Sheets or documents</h3>
        </div>
        <CheckItems items={wuup} className="relative border-t border-st-secondary pt-6" />
        <ButtonLink href={SIGNUP} variant="ink" arrow className="relative mt-auto self-start">
          Start free
        </ButtonLink>
      </article>
      <article className="flex flex-col gap-6 rounded-2xl border border-st-secondary bg-sf-white p-6 md:p-8">
        <div className="flex flex-col gap-1.5">
          <p className="text-caption font-medium text-tx-tertiary">Choose {themName} if</p>
          <h3 className="text-heading-3 font-medium tracking-card text-tx">It fits the way you already work</h3>
        </div>
        <CheckItems items={them} className="border-t border-st-secondary pt-6" />
      </article>
    </div>
  );
}

export function CompareTemplate({ page }: { page: ComparePageFull }) {
  const them = page.competitor.name;
  return (
    <>
      <JsonLd data={graph(breadcrumbList(crumbsFor(page.path)))} />
      <InnerSheet>
        <HeroCompact
          eyebrow="Compare"
          title={page.h1}
          lead={`${page.competitor.summary} Here is how it compares with wuup, using facts checked against ${them}'s own pages, and when each is the better choice.`}
          actions={
            <>
              <ButtonLink href="#table" variant="hero-primary">
                See the comparison
              </ButtonLink>
              <ButtonLink href={page.competitor.url} variant="hero-outline" target="_blank" rel="noopener noreferrer nofollow">
                Visit {them}
              </ButtonLink>
            </>
          }
        />

        <section className="container section -mt-8 md:-mt-12" aria-label="Verdict">
          <VerdictCards wuup={page.verdict.chooseWuup} them={page.verdict.chooseThem} themName={them} />
        </section>

        <section id="table" className="container section scroll-mt-24" aria-label="Side by side">
          <SectionHead title={`wuup and ${them},\nside by side`} intro="Open a group to see each row. Icons show support at a glance; the text says how." />
          <CompareTable groups={page.groups} them={them} verifiedOn={page.verifiedOn} />
        </section>

        <section className="container section" aria-label="In detail">
          <SectionHead title={"The differences\nthat matter"} />
          <ProseSplit sections={page.sections} />
          <div className="w-full">
            <SourcesList sources={page.sources} verifiedOn={page.verifiedOn} />
          </div>
        </section>

        <section className="container section" aria-label="Related">
          <SectionHead title={"Keep comparing"} intro="Other comparisons, alternatives and the pages that show what wuup does." />
          <LinkColumns
            columns={[
              { title: "Comparisons", links: liveLinks([...comparisons.map((c) => c.path).filter((p) => p !== page.path), "/compare"]) },
              { title: "Alternatives", links: liveLinks(alternatives.map((a) => a.path)) },
              { title: "wuup", links: liveLinks(page.related.filter((p) => !p.startsWith("/compare") && !p.startsWith("/alternatives")).concat(["/chat-with-mongodb", "/security", "/pricing"])) },
              { title: "Free tools", links: liveLinks(["/tools/mongodb-query-generator", "/tools/sql-to-mongodb-converter", "/tools/mongodb-aggregation-generator"]) },
            ]}
          />
        </section>

        {page.faqs?.length ? <FaqSection items={page.faqs} /> : null}
        <div className="container -mt-8 flex justify-center">
          <a
            href={page.competitor.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-1.5 text-caption text-tx-tertiary hover:text-tx"
          >
            <Scale className="size-4" strokeWidth={1.75} aria-hidden="true" />
            {them} is a trademark of its owner. This page is wuup&apos;s own comparison.
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </a>
        </div>
        <CtaBand title={"Ask your data,\nsee the query."} secondary={{ label: "See pricing", href: "/pricing" }} />
      </InnerSheet>
      <PageSheetEnd />
    </>
  );
}
