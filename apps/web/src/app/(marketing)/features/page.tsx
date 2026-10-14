import Link from "next/link";
import {
  ChartColumn,
  Code2,
  Database,
  FileText,
  Globe,
  KeyRound,
  Link2,
  ListChecks,
  Lock,
  MessageCircleQuestion,
  MessageSquareText,
  ScanSearch,
  ServerOff,
  ShieldCheck,
  Telescope,
} from "lucide-react";
import { CtaBand } from "@/components/marketing/cta-band";
import { FactRow } from "@/components/marketing/fact-row";
import { FeatureTour, type TourCard } from "@/components/marketing/feature-tour";
import { FaqSection } from "@/components/marketing/faq";
import { HeroCompact } from "@/components/marketing/hero-compact";
import { InnerSheet, PageSheetEnd } from "@/components/marketing/page-sheet";
import { StepperBand } from "@/components/marketing/stepper-band";
import { TrustPair } from "@/components/marketing/trust-pair";
import { JsonLd } from "@/components/seo/JsonLd";
import { ArrowIcon, ButtonLink } from "@/components/ui/button";
import { SectionHead } from "@/components/ui/section";
import { featureTour, features } from "@/content/data/features";
import { breadcrumbList, graph } from "@/lib/jsonld";
import { breadcrumbsFor } from "@/lib/registry";
import { pageMetadata } from "@/lib/seo";
import { FACTS, SIGNUP } from "@/lib/site";
import {
  AskPanel,
  ChartsInset,
  ClarifyInset,
  ConnectPanel,
  DocsInset,
  KeyInset,
  QueriesInset,
  ResearchInset,
  ScopePanel,
  VerifyPanel,
  WebInset,
} from "./_components/mocks";

const PATH = "/features";
export const metadata = pageMetadata(PATH);

const page = features[0]!;

const TOUR_VISUALS: Record<string, { icon: React.ReactNode; media: React.ReactNode }> = {
  charts: { icon: <ChartColumn />, media: <ChartsInset /> },
  queries: { icon: <Code2 />, media: <QueriesInset /> },
  documents: { icon: <FileText />, media: <DocsInset /> },
  clarify: { icon: <MessageCircleQuestion />, media: <ClarifyInset /> },
  web: { icon: <Globe />, media: <WebInset /> },
  research: { icon: <Telescope />, media: <ResearchInset /> },
  byok: { icon: <KeyRound />, media: <KeyInset /> },
};

const tourCards: TourCard[] = featureTour.map((t) => ({ ...t, ...TOUR_VISUALS[t.id]! }));

const STEP_ICONS = [<Link2 key="c" />, <ListChecks key="s" />, <MessageSquareText key="a" />, <ScanSearch key="v" />];
const STEP_PANELS = [<ConnectPanel key="c" />, <ScopePanel key="s" />, <AskPanel key="a" />, <VerifyPanel key="v" />];

const SOURCES = [
  { logo: "/logos/mongodb.svg", name: "MongoDB", note: "Read-only, schema-aware" },
  { logo: "/logos/google-sheets.svg", name: "Google Sheets", note: "Every tab, like a table" },
  { logo: "/logos/pdf.svg", name: "PDF and TXT", note: "Private knowledge base" },
];
const MODELS = [
  { logo: "/logos/gemini.svg", name: "Gemini", note: "Free questions run here" },
  { logo: "/logos/openai.svg", name: "OpenAI", note: "With your key" },
  { logo: "/logos/anthropic.svg", name: "Anthropic", note: "With your key" },
  { logo: "/logos/openrouter.svg", name: "OpenRouter", note: "With your key" },
];

function LogoCell({ logo, name, note }: { logo: string; name: string; note: string }) {
  return (
    <li className="flex items-center gap-3 px-5 py-5 md:flex-col md:items-start md:gap-4 md:px-8 md:py-7">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-st-secondary bg-sf-white md:size-12">
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny static brand svg */}
        <img src={logo} alt="" width={24} height={24} className="size-6" />
      </span>
      <span className="flex flex-col">
        <span className="text-body-lg font-medium leading-[1.3] text-tx">{name}</span>
        <span className="text-caption text-tx-tertiary">{note}</span>
      </span>
    </li>
  );
}

export default function FeaturesPage() {
  return (
    <>
      <JsonLd data={graph(breadcrumbList(breadcrumbsFor(PATH)))} />
      <InnerSheet>
        <div>
          <HeroCompact
            eyebrow="Features"
            title={page.h1}
            lead={page.lead}
            actions={
              <>
                <ButtonLink href={SIGNUP} variant="hero-primary">
                  Start free
                </ButtonLink>
                <ButtonLink href="/security" variant="hero-outline">
                  How it stays read-only
                </ButtonLink>
              </>
            }
          />
          <StepperBand
            label="How wuup works, in four steps"
            steps={(page.howItWorks ?? []).map((s, i) => ({
              ...s,
              icon: STEP_ICONS[i],
              panel: STEP_PANELS[i],
            }))}
          />
        </div>

        <FactRow
          items={[
            { value: FACTS.freeQuestions, label: "free questions on Gemini to start, no card" },
            { value: FACTS.maxRowsPerQuery, unit: "rows", label: "hard cap on every query, so answers stay fast and focused" },
            { value: FACTS.queryTimeoutS, unit: "s", label: "time limit on every query before it is stopped" },
          ]}
        />

        <section className="container section" aria-label="Sources and models">
          <SectionHead
            title={"Your data and your model,\nin one place"}
            intro="Connect the sources you already use. Answer with Gemini for free, or with your own key."
          />
          <div className="flex w-full flex-col divide-y divide-st-secondary border-y border-st-secondary">
            <div className="grid md:grid-cols-[200px_1fr]">
              <p className="px-5 pt-5 text-label font-medium uppercase tracking-[0.17em] text-tx-tertiary md:self-center md:px-0 md:pt-0">
                Data sources
              </p>
              <ul className="m-0 grid list-none grid-cols-1 p-0 sm:grid-cols-3 md:divide-x md:divide-st-secondary md:border-l md:border-st-secondary">
                {SOURCES.map((s) => (
                  <LogoCell key={s.name} {...s} />
                ))}
              </ul>
            </div>
            <Link
              href="/security"
              className="group grid gap-4 px-5 py-6 transition-colors duration-200 hover:bg-sf-secondary md:grid-cols-6 md:items-center md:gap-8"
            >
              <span className="flex items-center gap-2 text-caption font-medium text-indigo-800 md:col-span-1">
                <ShieldCheck className="size-5" strokeWidth={1.5} aria-hidden="true" /> Our rule
              </span>
              <span className="font-display text-[20px] leading-[1.45] text-tx md:col-span-4 md:text-[22px]">
                Every number in an answer comes from a row you can see, and every query is one you can run again yourself.
              </span>
              <span className="inline-flex items-center gap-1.5 text-caption font-medium text-tx-secondary group-hover:text-tx md:col-span-1 md:justify-end">
                How it works <ArrowIcon className="size-4" />
              </span>
            </Link>
            <div className="grid md:grid-cols-[200px_1fr]">
              <p className="px-5 pt-5 text-label font-medium uppercase tracking-[0.17em] text-tx-tertiary md:self-center md:px-0 md:pt-0">
                Models
              </p>
              <ul className="m-0 grid list-none grid-cols-1 p-0 sm:grid-cols-2 lg:grid-cols-4 md:divide-x md:divide-st-secondary md:border-l md:border-st-secondary">
                {MODELS.map((s) => (
                  <LogoCell key={s.name} {...s} />
                ))}
              </ul>
            </div>
          </div>
          <p className="text-caption text-tx-tertiary">PostgreSQL and MySQL are on the roadmap.</p>
        </section>

        <section className="container section" aria-label="Feature tour">
          <SectionHead
            title={"Ask. See. Check."}
            intro="Every part of a wuup answer is there so you can trust it, or prove it wrong in a minute."
          />
          <FeatureTour cards={tourCards} label="Features" />
        </section>

        <section className="container section" aria-labelledby="trust-title">
          <div className="section__head">
            <h2 id="trust-title" className="h-section">
              Read-only by design.
            </h2>
            <p className="intro">Security and privacy</p>
          </div>
          <TrustPair
            left={{
              title: "Guarded at the query",
              body: "Every query passes a guard before it touches your database. These limits are enforced in code, on every plan.",
              tiles: [
                { seal: FACTS.blockedOperators.length, sealCaption: "blocked", label: "Write and JS operators", value: "$out, $merge, $where", chip: "Blocked" },
                { seal: FACTS.maxRowsPerQuery, sealCaption: "rows", label: "Rows per query", value: `Up to ${FACTS.maxRowsPerQuery}`, chip: "Capped" },
                { seal: `${FACTS.queryTimeoutS}s`, sealCaption: "limit", label: "Query timeout", value: `${FACTS.queryTimeoutS} seconds`, chip: "Enforced" },
                { seal: "256", sealCaption: "AES-GCM", label: "Connection strings", value: "AES-256-GCM", chip: "Encrypted" },
              ],
            }}
            right={{
              title: "Private by default",
              body: "The model sees the schema and the rows a query returns. Sensitive fields and collections you did not pick stay out.",
              feature: {
                icon: <Lock />,
                title: "Sensitive fields",
                sub: "Hidden automatically, at any depth",
                chip: "Redacted",
              },
              rows: [
                { icon: <Database />, label: "Collections", value: "Only the ones you scope" },
                { icon: <ServerOff />, label: "System databases", value: FACTS.systemDatabases.join(", ") + " off-limits" },
                { icon: <ShieldCheck />, label: "Writes", value: "Never" },
                { icon: <KeyRound />, label: "Your AI key", value: "Masked in the app" },
              ],
            }}
          />
          <ButtonLink href="/security" variant="soft" className="min-h-10 px-5 py-2 text-[15px]">
            Read how security works
          </ButtonLink>
        </section>

        {page.faqs?.length ? <FaqSection title={"Questions about\nwhat wuup does"} items={page.faqs} /> : null}

        <CtaBand
          title={"Ask a question.\nSee the query."}
          secondary={{ label: "See pricing", href: "/pricing" }}
        />
      </InnerSheet>
      <PageSheetEnd className="md:-mt-12" />
    </>
  );
}
