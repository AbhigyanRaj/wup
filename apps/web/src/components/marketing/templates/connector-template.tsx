import type { ReactNode } from "react";
import {
  BarChart3,
  Braces,
  CircleHelp,
  Code2,
  Database,
  EyeOff,
  FileText,
  KeyRound,
  Layers,
  Link2,
  Lock,
  MessageSquareText,
  Quote,
  Shapes,
  ShieldCheck,
  Sheet,
  MessageSquarePlus,
  TriangleAlert,
} from "lucide-react";
import {
  AssistantHead,
  BarChart,
  Cite,
  FollowUps,
  MiniTable,
  MockCard,
  MockWindow,
  QueriesRow,
  SourceChip,
  UserBubble,
  ChartsAnswer,
  DocsAnswer,
  QueriesAnswer,
  SheetsAnswer,
} from "@/components/marketing/answer-mock";
import { CtaBand } from "@/components/marketing/cta-band";
import { FactRow } from "@/components/marketing/fact-row";
import { FaqSection } from "@/components/marketing/faq";
import { FeatureTour, type TourCard } from "@/components/marketing/feature-tour";
import { HeroCompact } from "@/components/marketing/hero-compact";
import { InnerSheet, PageSheetEnd } from "@/components/marketing/page-sheet";
import { TrustPair } from "@/components/marketing/trust-pair";
import { JsonLd } from "@/components/seo/JsonLd";
import { ButtonLink } from "@/components/ui/button";
import { SectionHead } from "@/components/ui/section";
import type { AnswerMock, ConnectorPageFull } from "@/content/data/connectors";
import { useCases } from "@/content/data/use-cases";
import { alternatives } from "@/content/data/alternatives";
import type { Accent } from "@/content/types";
import { breadcrumbList, graph } from "@/lib/jsonld";

import { SIGNUP } from "@/lib/site";
import { LimitsCard, LinkColumns, liveLinks, NumberedSteps, crumbsFor } from "./shared";

const LOGO: Record<ConnectorPageFull["source"], string> = {
  mongodb: "/logos/mongodb.svg",
  "google-sheets": "/logos/google-sheets.svg",
  pdf: "/logos/pdf.svg",
};

/* ------------------------------------------------------------------ */
/* Coded answer mock built from content data                           */
/* ------------------------------------------------------------------ */

function withCites(text: string): ReactNode[] {
  return text.split(/(\[\d+\])/g).map((part, i) => {
    const m = /^\[(\d+)\]$/.exec(part);
    return m ? <Cite key={i} n={Number(m[1])} /> : part;
  });
}

export function ConnectorAnswer({ mock, logo, compact = false }: { mock: AnswerMock; logo: string; compact?: boolean }) {
  const numericCols = mock.columns.map((_, i) => i).filter((i) => mock.rows.every((r) => typeof r[i] === "number"));
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <UserBubble>{mock.question}</UserBubble>
      <div className="flex flex-col gap-3">
        <AssistantHead meta={mock.query ? `from ${mock.query.label}` : `from ${mock.sources?.length ?? 0} documents`} />
        <p className="text-[13.5px] leading-[1.6] text-tx-secondary">{withCites(mock.answer)}</p>
        <div className={compact ? "grid gap-2.5" : "grid gap-2.5 md:grid-cols-[1.3fr_1fr]"}>
          {mock.visual === "bar" ? (
            <MockCard title={mock.columns[1]} meta="built from returned rows">
              <BarChart data={mock.rows.map((r) => ({ label: String(r[0]), value: Number(r[1]) }))} highlight={1} format={(v) => `${Math.round(v / 1000)}k`} />
            </MockCard>
          ) : (
            <MockCard title="Result" meta={`${mock.rows.length} rows`}>
              <MiniTable columns={mock.columns} rows={mock.rows} numeric={numericCols} />
            </MockCard>
          )}
          {!compact && mock.sources?.length ? (
            <MockCard title="Sources" meta={`${mock.sources.length} cited`}>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {mock.sources.map((s) => (
                  <li key={s.n} className="flex items-start gap-2 text-[12px] leading-[1.45]">
                    <Cite n={s.n} />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium text-tx">{s.title}</span>
                      <span className="text-tx-muted">{s.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </MockCard>
          ) : null}
        </div>
        {mock.query ? <QueriesRow count={1} detail={mock.query.code.replace(/\s+/g, " ").slice(0, 80)} /> : null}
        <FollowUps items={mock.followUps} />
      </div>
      <span className="sr-only">{`Illustrative answer with sample data. Logo: ${logo}`}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tour media                                                          */
/* ------------------------------------------------------------------ */

function SchemaScanMock() {
  const rows: Array<[string, string, string]> = [
    ["_id", "ObjectId", "100%"],
    ["customerId", "ObjectId", "100%"],
    ["status", "string", "100%"],
    ["items[].sku", "string", "100%"],
    ["total", "number", "100%"],
    ["createdAt", "date", "100%"],
    ["couponCode", "string | null", "40%"],
    ["password_hash", "hidden", "redacted"],
  ];
  return (
    <div className="flex flex-col gap-3 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <Database className="size-4 text-blue-700" strokeWidth={1.75} aria-hidden="true" />
        <p className="text-[13px] font-medium text-tx">shop.orders</p>
        <span className="ml-auto rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">Schema scanned</span>
      </div>
      <MockCard title="Fields" meta="sampled automatically">
        <MiniTable columns={["Field", "Type", "Present"]} rows={rows} highlightRow={7} />
      </MockCard>
    </div>
  );
}

function ClarifyMock({ question, options }: { question: string; options: string[] }) {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <UserBubble>How many active users do we have?</UserBubble>
      <div className="flex flex-col gap-3">
        <AssistantHead meta="needs one detail first" />
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3.5">
          <p className="flex items-center gap-2 text-[13px] font-medium text-tx">
            <CircleHelp className="size-4 text-indigo-700" strokeWidth={1.75} aria-hidden="true" />
            {question}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {options.map((o, i) => (
              <span
                key={o}
                className={
                  i === 0
                    ? "rounded-full border border-indigo-300 bg-sf-white px-3 py-1.5 text-[12px] font-medium text-indigo-800"
                    : "rounded-full border border-st bg-sf-white px-3 py-1.5 text-[12px] text-tx-secondary"
                }
              >
                {o}
              </span>
            ))}
          </div>
        </div>
        <FollowUps items={["Weekly active users instead", "Split by plan"]} />
      </div>
    </div>
  );
}

function MixedSourcesMock() {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <UserBubble>Did September revenue hit the target in the plan sheet?</UserBubble>
      <div className="flex flex-col gap-3">
        <AssistantHead meta="from MongoDB and Google Sheets" />
        <p className="text-[13.5px] leading-[1.6] text-tx-secondary">
          September revenue was <b className="font-medium text-tx">₹47,095</b> <Cite n={1} />, 6% above the ₹44,500 target <Cite n={2} />.
        </p>
        <MockCard title="Actual vs target" meta="2 sources">
          <MiniTable columns={["Month", "Actual", "Target", "Delta"]} numeric={[1, 2, 3]} highlightRow={1} rows={[["Aug", "12,999", "15,000", "-13%"], ["Sep", "47,095", "44,500", "+6%"]]} />
        </MockCard>
        <div className="flex flex-wrap gap-1.5">
          <SourceChip logo="/logos/mongodb.svg">1 · shop.orders</SourceChip>
          <SourceChip logo="/logos/google-sheets.svg">2 · Plan!A1:C13</SourceChip>
        </div>
      </div>
    </div>
  );
}

function RangeMock() {
  return (
    <div className="flex flex-col gap-3 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <Sheet className="size-4 text-green-700" strokeWidth={1.75} aria-hidden="true" />
        <p className="text-[13px] font-medium text-tx">Q3 Sales Pipeline</p>
        <span className="ml-auto rounded-full bg-sf-secondary px-2 py-0.5 font-mono text-[11px] text-tx-tertiary">Pipeline!A1:H39</span>
      </div>
      <MockCard title="Cells read" meta="header row + 38 rows">
        <MiniTable
          columns={["Deal", "Owner", "Stage", "Value (₹ L)"]}
          numeric={[3]}
          highlightRow={1}
          rows={[
            ["Acme renewal", "Neha", "Proposal", 12.5],
            ["Northwind POS", "Arjun", "Proposal", 18.0],
            ["Globex pilot", "Neha", "Demo", 6.2],
            ["Initech rollout", "Kabir", "Negotiation", 9.8],
          ]}
        />
      </MockCard>
      <QueriesRow count={1} detail="Read Pipeline!A1:H39, filter Stage = Proposal" open />
    </div>
  );
}

const TOUR: Record<ConnectorPageFull["source"], Array<{ nav: string; icon: ReactNode; bullets: string[]; media: ReactNode }>> = {
  mongodb: [
    { nav: "Schema-aware", icon: <Braces />, bullets: ["Fields, types and nesting sampled", "ObjectIds and dates typed correctly", "Sensitive fields redacted"], media: <SchemaScanMock /> },
    { nav: "Queries shown", icon: <Code2 />, bullets: ["Every find and aggregate listed", "Copy into mongosh or Compass", "Checked by the read-only guard"], media: <QueriesAnswer /> },
    { nav: "Real charts", icon: <BarChart3 />, bullets: ["Bar, line and table views", "Built from returned rows", "Capped results are flagged"], media: <ChartsAnswer /> },
    { nav: "Follow-ups", icon: <MessageSquareText />, bullets: ["Asks before guessing", "Suggested follow-ups", "Context kept across turns"], media: <ClarifyMock question="Which event counts as active?" options={["Any event", "Purchase", "Page view"]} /> },
  ],
  "google-sheets": [
    { nav: "Across tabs", icon: <Layers />, bullets: ["All tabs and headers known", "Compare tabs in one answer", "Header names, not cell letters"], media: <SheetsAnswer /> },
    { nav: "Range shown", icon: <Link2 />, bullets: ["Tab and range on every answer", "Open the same cells to verify", "Capped reads are flagged"], media: <RangeMock /> },
    { nav: "Real charts", icon: <BarChart3 />, bullets: ["Charts match the cells", "Tables you can copy", "No formulas rewritten"], media: <ChartsAnswer /> },
    { nav: "Mixed sources", icon: <Shapes />, bullets: ["Sheets plus MongoDB", "Sheets plus PDFs", "Each source cited"], media: <MixedSourcesMock /> },
  ],
  pdf: [
    { nav: "Citations", icon: <Quote />, bullets: ["Numbered citations", "Document and section shown", "Trace every claim"], media: <DocsAnswer /> },
    { nav: "Many files", icon: <FileText />, bullets: ["Search by meaning", "Across every uploaded file", "Side-by-side comparisons"], media: <PdfCompareMock /> },
    { nav: "Docs and data", icon: <Shapes />, bullets: ["Documents plus live data", "Separate citations per source", "One chat, one answer"], media: <MixedSourcesMock /> },
    { nav: "Follow-ups", icon: <MessageSquarePlus />, bullets: ["Suggested follow-ups", "Remembers the documents in play", "Drill into one clause"], media: <PdfFollowMock /> },
  ],
};

function PdfCompareMock() {
  return (
    <div className="flex flex-col gap-3 p-4 md:p-6">
      <UserBubble>Compare the implementation quotes in the three proposals</UserBubble>
      <AssistantHead meta="from 3 documents" />
      <MockCard title="Implementation quotes" meta="3 cited">
        <MiniTable
          columns={["Vendor", "Quote", "Timeline"]}
          numeric={[1]}
          highlightRow={1}
          rows={[
            ["Brightline [1]", "₹8.4 L", "10 weeks"],
            ["Corvid [2]", "₹6.9 L", "12 weeks"],
            ["Helix [3]", "₹9.1 L", "8 weeks"],
          ]}
        />
      </MockCard>
      <FollowUps items={["Which includes support?", "Show payment terms"]} />
    </div>
  );
}

function PdfFollowMock() {
  return (
    <div className="flex flex-col gap-3 p-4 md:p-6">
      <UserBubble>What penalties apply for early termination?</UserBubble>
      <AssistantHead meta="continuing from the vendor contracts" />
      <p className="text-[13.5px] leading-[1.6] text-tx-secondary">
        Northwind charges the remaining fees for the current term <Cite n={1} />. Acme has no penalty after year one, but unpaid invoices fall due at once <Cite n={2} />.
      </p>
      <FollowUps items={["When does each renew?", "Who signs notices?", "Summarise both contracts"]} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Template                                                            */
/* ------------------------------------------------------------------ */

const GLOSSARY: Record<ConnectorPageFull["source"], string[]> = {
  mongodb: ["/glossary/aggregation-pipeline", "/glossary/lookup", "/glossary/text-to-sql"],
  "google-sheets": ["/glossary/text-to-sql", "/glossary/rag"],
  pdf: ["/glossary/rag", "/glossary/vector-search"],
};

const ACCENTS: Accent[] = ["blue", "indigo", "sky", "periwinkle"];

export function ConnectorTemplate({ page }: { page: ConnectorPageFull }) {
  const logo = LOGO[page.source];
  const tour: TourCard[] = page.tour.map((t, i) => ({
    id: `tour-${i + 1}`,
    nav: TOUR[page.source][i]?.nav ?? t.title,
    title: t.title,
    body: t.body,
    bullets: TOUR[page.source][i]?.bullets ?? [],
    accent: t.accent ?? ACCENTS[i % ACCENTS.length],
    icon: TOUR[page.source][i]?.icon ?? <MessageSquarePlus />,
    media: TOUR[page.source][i]?.media ?? null,
  }));
  const factItems = page.facts.map((f) => {
    const m = /^(\d[\d,.]*)\s*(.*)$/.exec(f.value);
    return m ? { value: m[1], unit: m[2] || undefined, label: f.label } : { value: f.value, label: f.label };
  });

  return (
    <>
      <JsonLd data={graph(breadcrumbList(crumbsFor(page.path)))} />
      <InnerSheet>
        <div className="flex flex-col">
          <HeroCompact
            eyebrow={`${page.sourceName} · ${page.badge}`}
            title={page.h1}
            lead={page.lead}
            actions={
              <>
                <ButtonLink href={SIGNUP} variant="hero-primary">
                  Start free
                </ButtonLink>
                <ButtonLink href="#how" variant="hero-outline">
                  See how it works
                </ButtonLink>
              </>
            }
          />
          <section className="relative -mt-10 md:-mt-14" aria-label="Example answer">
            <div aria-hidden="true" className="absolute inset-x-0 top-16 bottom-10 bg-[linear-gradient(180deg,#fcfcfc_0%,#c9d8fb_35%,#d8eefc_70%,#fcfcfc_100%)] blur-2xl" />
            <div className="container relative">
              <MockWindow
                title={page.mock.question}
                source={
                  <>
                    <SourceChip logo={logo}>{page.mock.sources?.[0]?.title ?? page.sourceName}</SourceChip>
                    <span className="hidden rounded-full bg-sf-secondary px-2.5 py-1 text-[11.5px] text-tx-tertiary sm:inline">Read-only</span>
                  </>
                }
              >
                <ConnectorAnswer mock={page.mock} logo={logo} />
              </MockWindow>
              <p className="mt-3 text-center text-label text-tx-tertiary">Illustrative answer on sample data. Your answers use your own {page.sourceName}.</p>
            </div>
          </section>
        </div>

        <FactRow items={factItems} />

        <section id="how" className="container section scroll-mt-24" aria-label="How it works">
          <SectionHead title={`Connect ${page.sourceName}\nin four steps`} intro="No pipelines to build and no data to copy. wuup reads what it needs, when you ask." />
          <NumberedSteps steps={page.steps} />
        </section>

        <section className="container section" aria-label="Example questions">
          <SectionHead title={"Questions people ask\non day one"} intro={`Real questions you can type as they are. wuup works out the ${page.source === "pdf" ? "passages" : "query"} for you.`} />
          <ul className="m-0 grid w-full list-none gap-2 p-0 sm:grid-cols-2">
            {page.exampleQuestions.map((q, i) => (
              <li key={q} className="flex items-center gap-4 rounded-2xl border border-st-secondary bg-sf-white px-5 py-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[linear-gradient(135deg,#dbeafe,#eff6ff)] font-mono text-[12px] text-blue-800 tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-body leading-[1.5] text-tx">{q}</span>
              </li>
            ))}
          </ul>
          <ButtonLink href={SIGNUP} variant="soft" arrow>
            Ask your own question
          </ButtonLink>
        </section>

        <section className="container section" aria-label="Features">
          <SectionHead title={"See it. Check it.\nTrust it."} intro="What happens between your question and the answer." />
          <FeatureTour cards={tour} label={`${page.sourceName} features`} />
        </section>

        <section className="container section" aria-label="Security">
          <SectionHead title={"Built to read,\nnever to write"} intro="Security and privacy" />
          <TrustPair
            left={{
              title: "What's enforced",
              body: page.trust[0]?.body ?? "",
              tiles: page.trust.slice(0, 2).map((t, i) => ({
                seal: i === 0 ? <Lock className="size-6" strokeWidth={1.6} /> : <ShieldCheck className="size-6" strokeWidth={1.6} />,
                label: t.title,
                value: i === 0 ? "Read only" : page.source === "mongodb" ? "Your scope" : "Your choice",
                chip: "Enforced",
              })),
            }}
            right={{
              title: "Your data, your rules",
              body: page.trust[2]?.body ?? "",
              feature: {
                icon: page.source === "mongodb" ? <EyeOff /> : page.source === "pdf" ? <FileText /> : <KeyRound />,
                title: page.trust[2]?.title ?? "Private",
                sub: "Applies to every question",
                chip: "Default",
              },
              rows: page.trustRows.map((r, i) => ({
                icon: [<Lock key="a" />, <ShieldCheck key="b" />, <EyeOff key="c" />, <KeyRound key="d" />, <Database key="e" />][i % 5],
                label: r.label,
                value: r.value,
              })),
            }}
          />
          <ButtonLink href="/security" variant="soft">
            How wuup keeps data safe
          </ButtonLink>
        </section>

        <section className="container section" aria-label="Limits">
          <SectionHead title={"Honest limits"} intro="What this connector doesn't do today, so there are no surprises." />
          <div className="w-full max-w-[900px]">
            <LimitsCard title={`${page.sourceName}: good to know`} items={page.limits} icon={<TriangleAlert />} />
          </div>
        </section>

        <section className="container section" aria-label="Related">
          <SectionHead title={"Go further"} intro="Free tools to try now, guides to read, and how wuup compares." />
          <LinkColumns
            columns={[
              { title: "Free tools", links: liveLinks(page.tools) },
              { title: "Guides", links: liveLinks([...page.guides, "/security"]) },
              { title: "Compare", links: liveLinks([...page.compare, ...alternatives.map((a) => a.path)].slice(0, 5)) },
              { title: "Use cases", links: liveLinks(useCases.filter((u) => u.connectors.includes(page.path)).map((u) => u.path)) },
              { title: "Glossary", links: liveLinks(GLOSSARY[page.source]) },
            ]}
          />
        </section>

        {page.faqs?.length ? <FaqSection items={page.faqs} /> : null}
        <CtaBand title={`Your ${page.sourceName} has answers.\nStart asking.`} secondary={{ label: "See pricing", href: "/pricing" }} />
      </InnerSheet>
      <PageSheetEnd />
    </>
  );
}
