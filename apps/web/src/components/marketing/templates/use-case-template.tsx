import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import { BookOpenText, Database, FileText, Sheet, Lightbulb, Target, UserRound } from "lucide-react";
import { CtaBand } from "@/components/marketing/cta-band";
import { FaqSection } from "@/components/marketing/faq";
import { HeroCompact } from "@/components/marketing/hero-compact";
import { InnerSheet, PageSheetEnd } from "@/components/marketing/page-sheet";
import { JsonLd } from "@/components/seo/JsonLd";
import { highlight } from "@/components/tools/code-tokens";
import { ButtonLink } from "@/components/ui/button";
import { SectionHead } from "@/components/ui/section";
import { useCases, type UseCasePageFull } from "@/content/data/use-cases";
import { breadcrumbList, graph } from "@/lib/jsonld";

import { SIGNUP } from "@/lib/site";
import { formatQuery } from "@/lib/tools/mongo-format";
import { cn } from "@/lib/cn";
import { CheckItems, LinkColumns, liveLinks, NumberedSteps, crumbsFor } from "./shared";

/** Whether a /public asset exists (generated images may still be missing). */
export function publicAssetExists(src: string): boolean {
  try {
    return fs.existsSync(path.join(process.cwd(), "public", src));
  } catch {
    return false;
  }
}

function sourceIcon(s: string) {
  if (/mongo/i.test(s)) return <Database className="size-3.5" aria-hidden="true" />;
  if (/sheet/i.test(s)) return <Sheet className="size-3.5" aria-hidden="true" />;
  return <FileText className="size-3.5" aria-hidden="true" />;
}

const TOUR_TONES = [
  "bg-[linear-gradient(160deg,#ffffff_0%,#d2dff9_100%)]",
  "bg-[linear-gradient(160deg,#ffffff_0%,#d6ecfb_100%)]",
  "bg-[linear-gradient(160deg,#ffffff_0%,#e2dcfb_100%)]",
];

export function UseCaseTemplate({ page }: { page: UseCasePageFull }) {
  const hasCover = publicAssetExists(page.cover);
  const primary = page.connectors[0];
  return (
    <>
      <JsonLd data={graph(breadcrumbList(crumbsFor(page.path)))} />
      <InnerSheet>
        <HeroCompact
          eyebrow="Use case"
          title={page.h1}
          lead={page.lead}
          actions={
            <>
              <ButtonLink href={SIGNUP} variant="hero-primary">
                Start free
              </ButtonLink>
              <ButtonLink href="#questions" variant="hero-outline">
                See the questions
              </ButtonLink>
            </>
          }
        />

        <section className="container -mt-8 md:-mt-12" aria-label="Overview">
          <div className="grid w-full gap-4 md:grid-cols-[1.25fr_1fr]">
            <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-st-secondary bg-[linear-gradient(135deg,#dbeafe_0%,#c7d2fe_45%,#e0f2fe_100%)]">
              {hasCover ? (
                <Image src={page.cover} alt="" fill sizes="(min-width: 768px) 680px, 88vw" className="object-cover" preload />
              ) : (
                <div aria-hidden="true" className="absolute inset-0 grid place-items-center">
                  <div className="size-40 rounded-full bg-[radial-gradient(circle,#ffffff_0%,transparent_70%)] opacity-80" />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-6 rounded-2xl border border-st-secondary bg-sf-white p-6 md:p-8">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-800">
                  <UserRound className="size-5" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-caption font-medium text-tx-tertiary">Who it&apos;s for</p>
                  <p className="mt-0.5 text-body font-medium leading-[1.45] text-tx">{page.persona}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                <p className="text-caption font-medium text-tx-tertiary">Sources</p>
                <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                  {page.sources.map((s) => (
                    <li key={s} className="inline-flex items-center gap-1.5 rounded-full border border-st bg-sf-secondary px-3 py-1.5 text-caption text-tx-secondary">
                      {sourceIcon(s)}
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col gap-2.5 border-t border-st-secondary pt-5">
                <p className="text-caption font-medium text-tx-tertiary">The problem today</p>
                <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                  {page.problems.map((p) => (
                    <li key={p} className="flex gap-2.5 text-[15px] leading-[1.55] text-tx-secondary">
                      <span aria-hidden="true" className="mt-[9px] size-1.5 shrink-0 rounded-full bg-red-300" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section id="questions" className="container section scroll-mt-24" aria-label="Questions">
          <SectionHead title={"Six questions,\nand what wuup does"} intro="Ask in plain English. Here is what happens behind each answer, including the query when there is one." />
          <ol className="m-0 grid w-full list-none gap-4 p-0 lg:grid-cols-2">
            {page.qa.map((qa, i) => (
              <li key={qa.question} className="flex flex-col gap-4 rounded-2xl border border-st-secondary bg-sf-white p-6">
                <div className="flex items-start gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[linear-gradient(135deg,#dbeafe,#eff6ff)] font-mono text-[12px] text-blue-800 tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-[18px] font-medium leading-[1.4] text-tx">{qa.question}</h3>
                </div>
                <p className="flex gap-2 text-[15px] leading-[1.6] text-tx-secondary">
                  <Lightbulb className="mt-1 size-4 shrink-0 text-indigo-600" strokeWidth={1.75} aria-hidden="true" />
                  {qa.does}
                </p>
                {qa.query ? (
                  <pre className="mt-auto max-h-56 overflow-auto rounded-xl border border-st-secondary bg-[#fafafa] px-4 py-3 font-mono text-[12px] leading-[1.65] text-tx">
                    <code>{highlight(formatQuery(qa.query, "mongosh"))}</code>
                  </pre>
                ) : qa.read ? (
                  <p className="mt-auto flex items-center gap-2 rounded-xl border border-st-secondary bg-[#fafafa] px-4 py-3 font-mono text-[12px] text-tx-secondary">
                    <BookOpenText className="size-3.5 shrink-0 text-tx-tertiary" aria-hidden="true" />
                    Reads: {qa.read}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        </section>

        <section className="container section" aria-label="Workflow">
          <SectionHead title={"From question\nto answer"} />
          <NumberedSteps steps={page.workflow} />
        </section>

        {page.tour?.length ? (
          <section className="container section" aria-label="Why wuup">
            <SectionHead title={"Why it works\nfor this job"} />
            <div className="grid w-full gap-4 md:grid-cols-3">
              {page.tour.map((t, i) => (
                <article key={t.title} className="flex flex-col gap-6 rounded-[32px] border border-st-secondary bg-sf-white p-3">
                  <div className="flex flex-col gap-3 px-5 pt-5">
                    <h3 className="text-heading-4 font-medium leading-[1.25] text-tx-secondary">{t.title}</h3>
                    <p className="text-body leading-[1.6] text-tx-tertiary">{t.body}</p>
                  </div>
                  <div className={cn("mt-auto grid h-[150px] place-items-center rounded-[22px]", TOUR_TONES[i % TOUR_TONES.length])} aria-hidden="true">
                    <span className="grid size-16 place-items-center rounded-2xl border border-white/70 bg-white/60 text-indigo-700 shadow-[0_8px_30px_-10px_rgba(37,99,235,0.45)] backdrop-blur">
                      {[<Database key="a" className="size-7" strokeWidth={1.5} />, <Target key="b" className="size-7" strokeWidth={1.5} />, <Lightbulb key="c" className="size-7" strokeWidth={1.5} />][i % 3]}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="container section" aria-label="Outcomes">
          <div className="grid w-full gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-5 rounded-2xl border border-st-secondary bg-sf-white p-6 md:p-8">
              <h2 className="font-display text-heading-sub font-display-medium tracking-heading text-tx">What changes</h2>
              <CheckItems items={page.outcomes} />
              {primary ? (
                <ButtonLink href={primary} variant="soft" arrow className="mt-auto self-start">
                  How the connector works
                </ButtonLink>
              ) : null}
            </div>
            <LinkColumns
              className="md:grid-cols-1"
              columns={[
                { title: "Connectors", links: liveLinks(page.connectors) },
                { title: "Related", links: liveLinks([...page.related.filter((r) => !page.connectors.includes(r)), "/glossary/rag", "/glossary/vector-search", "/use-cases"]) },
                { title: "More use cases", links: liveLinks(useCases.filter((u) => u.path !== page.path).map((u) => u.path)) },
              ]}
            />
          </div>
        </section>

        {page.faqs?.length ? <FaqSection items={page.faqs} /> : null}
        <CtaBand title={"Bring the data.\nAsk the question."} secondary={{ label: "All use cases", href: "/use-cases" }} />
      </InnerSheet>
      <PageSheetEnd />
    </>
  );
}
