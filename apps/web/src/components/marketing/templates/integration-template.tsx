import { ArrowUpRight, KeyRound } from "lucide-react";
import { CtaBand } from "@/components/marketing/cta-band";
import { FaqSection } from "@/components/marketing/faq";
import { HeroCompact } from "@/components/marketing/hero-compact";
import { InnerSheet, PageSheetEnd } from "@/components/marketing/page-sheet";
import { JsonLd } from "@/components/seo/JsonLd";
import { ButtonLink } from "@/components/ui/button";
import { SectionHead } from "@/components/ui/section";
import type { IntegrationPageFull } from "@/content/data/integrations";
import { breadcrumbList, graph } from "@/lib/jsonld";

import { SIGNUP } from "@/lib/site";
import { LinkColumns, liveLinks, ProseSplit, crumbsFor } from "./shared";

export const PROVIDER_LOGO: Record<IntegrationPageFull["provider"], string> = {
  openai: "/logos/openai.svg",
  anthropic: "/logos/anthropic.svg",
  openrouter: "/logos/openrouter.svg",
  gemini: "/logos/gemini.svg",
  groq: "/logos/groq.svg",
};

export function IntegrationTemplate({ page }: { page: IntegrationPageFull }) {
  return (
    <>
      <JsonLd data={graph(breadcrumbList(crumbsFor(page.path)))} />
      <InnerSheet>
        <HeroCompact
          eyebrow="Bring your own key"
          title={page.h1}
          lead={page.lead}
          actions={
            <>
              <ButtonLink href={SIGNUP} variant="hero-primary">
                Start free
              </ButtonLink>
              <ButtonLink href={page.keyUrl} variant="hero-outline" target="_blank" rel="noopener noreferrer nofollow">
                Get a {page.partner.name} key
              </ButtonLink>
            </>
          }
        />

        <section className="container section -mt-8 md:-mt-12" aria-label="Set up">
          <div className="grid w-full gap-4 lg:grid-cols-[1fr_380px]">
            <ol className="m-0 flex list-none flex-col gap-0 rounded-2xl border border-st-secondary bg-sf-white p-2 md:p-3">
              {page.steps.map((s, i) => (
                <li key={s.title} className="flex gap-4 rounded-xl px-4 py-5 md:px-6 [&+li]:border-t [&+li]:border-st-secondary">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-indigo-100 text-caption font-medium text-indigo-800 tabular-nums">{i + 1}</span>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-body font-medium text-tx">{s.title}</h3>
                    <p className="text-[15px] leading-[1.6] text-tx-tertiary">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <aside className="flex flex-col gap-5 rounded-2xl border border-st-secondary bg-sf-white p-6">
              <div className="grid h-28 place-items-center rounded-xl border border-st-secondary bg-[linear-gradient(135deg,#e8effc_0%,#ffffff_100%)]">
                {/* eslint-disable-next-line @next/next/no-img-element -- static monochrome logo */}
                <img src={PROVIDER_LOGO[page.provider]} alt={`${page.partner.name} logo`} width={120} height={32} className="h-8 w-auto" />
              </div>
              <dl className="m-0 flex flex-col">
                {page.meta.map((m) => (
                  <div key={m.label} className="flex items-center justify-between gap-4 border-b border-st-secondary py-3 last:border-0">
                    <dt className="text-caption text-tx-tertiary">{m.label}</dt>
                    <dd className="m-0 text-right text-caption font-medium text-tx">{m.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex flex-col gap-2">
                <ButtonLink href={SIGNUP} variant="ink" block leadingIcon={<KeyRound className="size-4" aria-hidden="true" />}>
                  Add your key in wuup
                </ButtonLink>
                <a href={page.partner.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center justify-center gap-1 text-caption text-tx-tertiary hover:text-tx">
                  {page.partner.name} website <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </a>
                <a href={page.pricingUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center justify-center gap-1 text-caption text-tx-tertiary hover:text-tx">
                  {page.partner.name} pricing <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </a>
              </div>
            </aside>
          </div>
        </section>

        <section className="container section" aria-label="Details">
          <SectionHead title={"What to know"} />
          <ProseSplit sections={page.sections} />
        </section>

        <section className="container section" aria-label="Related">
          <SectionHead title={"Related"} />
          <LinkColumns
            columns={[
              { title: "Other providers", links: liveLinks([...page.related.filter((r) => r.startsWith("/integrations")), "/integrations"]) },
              { title: "Use it with", links: liveLinks([page.connector, "/chat-with-mongodb", "/chat-with-google-sheets", "/chat-with-pdf"]) },
              { title: "Pricing", links: liveLinks(["/byok", "/pricing", "/security"]) },
            ]}
          />
        </section>

        {page.faqs?.length ? <FaqSection items={page.faqs} /> : null}
        <CtaBand title={`Your ${page.partner.name} key,\nyour data, no markup.`} secondary={{ label: "All integrations", href: "/integrations" }} />
      </InnerSheet>
      <PageSheetEnd />
    </>
  );
}
