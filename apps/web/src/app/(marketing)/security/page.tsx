import Link from "next/link";
import {
  ArrowRight,
  Binary,
  BookOpen,
  Check,
  Database,
  EyeOff,
  FileText,
  KeyRound,
  Layers,
  Lock,
  MessageSquareText,
  Network,
  ServerOff,
  ShieldCheck,
  UserRoundCheck,
  X,
} from "lucide-react";
import { CtaBand } from "@/components/marketing/cta-band";
import { FactRow } from "@/components/marketing/fact-row";
import { FaqSection } from "@/components/marketing/faq";
import { HeroCompact } from "@/components/marketing/hero-compact";
import { InnerSheet, PageSheetEnd } from "@/components/marketing/page-sheet";
import { TrustPair } from "@/components/marketing/trust-pair";
import { JsonLd } from "@/components/seo/JsonLd";
import { ButtonLink } from "@/components/ui/button";
import { SectionHead } from "@/components/ui/section";
import { getFaqGroup } from "@/content/data/faqs";
import { breadcrumbList, graph } from "@/lib/jsonld";
import { breadcrumbsFor, getPage } from "@/lib/registry";
import { pageMetadata } from "@/lib/seo";
import { FACTS, SIGNUP, shipped } from "@/lib/site";
import { QueryPath } from "./_components/query-path";

const PATH = "/security";
export const metadata = pageMetadata(PATH);

const SEES: Array<{ icon: React.ReactNode; title: string; body: string }> = [
  { icon: <MessageSquareText />, title: "Your question", body: "And the conversation so far in that chat." },
  { icon: <Layers />, title: "A schema summary", body: "Collection and field names, types and a few sample values from the scan. Never samples of hidden fields." },
  { icon: <Database />, title: "The rows a query returned", body: `Up to ${FACTS.maxRowsPerQuery} rows and ${FACTS.maxResultKb} KB, with hidden fields already removed.` },
  { icon: <FileText />, title: "Cited passages", body: "For documents, the passages that answer the question, numbered as sources." },
];

const NEVER: Array<{ icon: React.ReactNode; title: string; body: string }> = [
  { icon: <Lock />, title: "Your connection string", body: "It is decrypted only to run a query and is never part of a prompt." },
  { icon: <EyeOff />, title: "Hidden fields", body: "Removed from every row and blocked inside queries, so they can't be filtered or grouped on." },
  { icon: <ServerOff />, title: "Collections you did not scope", body: `Or the ${FACTS.systemDatabases.join(", ")} databases, which are never queryable.` },
  { icon: <Binary />, title: "Binary fields", body: "Blobs such as embeddings are hidden automatically." },
];

const STORAGE: Array<{ title: string; body: string }> = [
  {
    title: "Your database stays where it is",
    body: "wuup runs queries on demand. It does not copy your collections. The schema scan keeps field names, types and a few sample values, never for hidden fields.",
  },
  {
    title: "Connection strings are encrypted",
    body: "They are encrypted with AES-256-GCM before they are stored, and decrypted only at the moment a query runs.",
  },
  {
    title: "Answers are saved with your chats",
    body: "Messages, charts, tables and the queries used are stored with the chat so you can return to them. Delete a chat when you no longer need it.",
  },
  {
    title: "The answering model sees the prompt",
    body: "Your question, the schema summary and the returned rows go to the AI provider that writes the answer: Gemini on free questions, or the provider of your own key.",
  },
];

const KEY_FACTS = [
  "You paste the key once in Settings. wuup checks it by listing your provider's models.",
  shipped.byokKeyEncrypted
    ? "It is encrypted with AES-256-GCM before it is stored."
    : "It is stored on your account and used only for your own questions.",
  "After saving, the app only ever shows a masked version of it.",
  "Remove it at any time and wuup stops using it right away.",
];

const YOUR_JOB = [
  {
    icon: <UserRoundCheck />,
    title: "Connect with a read-only user",
    body: "Give wuup a database user with the read role on one database. It is a second lock that does not depend on wuup.",
    link: { href: "/guides/mongodb-read-only-user", label: "Create a read-only user" },
  },
  {
    icon: <Network />,
    title: "Keep network access tight",
    body: "Use your cluster's IP access list and keep it as narrow as your setup allows. Remove connections you no longer use.",
  },
  {
    icon: <ShieldCheck />,
    title: "Scope the least you need",
    body: "Enable only the collections a question needs, and review the hidden fields for anything else that is sensitive.",
    link: { href: "/guides/is-it-safe-to-connect-database-to-ai", label: "Is it safe to connect a database to AI?" },
  },
];

export default function SecurityPage() {
  const h1 = getPage(PATH)?.h1 ?? "Read-only AI access\nto your database";
  const faqs = getFaqGroup("security")?.items ?? [];
  return (
    <>
      <JsonLd data={graph(breadcrumbList(breadcrumbsFor(PATH)))} />
      <InnerSheet>
        <HeroCompact
          eyebrow="Security"
          title={h1}
          lead={`wuup can read your MongoDB, never write to it. Every query passes a guard that blocks writes and server-side JavaScript, returns at most ${FACTS.maxRowsPerQuery} rows and stops after ${FACTS.queryTimeoutS} seconds. Here is exactly how, and what stays your job.`}
          actions={
            <>
              <ButtonLink href={SIGNUP} variant="hero-primary">
                Start free
              </ButtonLink>
              <ButtonLink href="/guides/mongodb-read-only-user" variant="hero-outline">
                Create a read-only user
              </ButtonLink>
            </>
          }
        />

        <FactRow
          className="-mt-8 md:-mt-16"
          items={[
            { value: FACTS.blockedOperators.length, unit: "operators", label: "write and server-side JavaScript operators blocked in every query" },
            { value: FACTS.maxRowsPerQuery, unit: "rows", label: "the most any single query can return" },
            { value: FACTS.queryTimeoutS, unit: "s", label: "time limit before a query is stopped" },
          ]}
        />

        <section className="container section" aria-labelledby="trust-title">
          <div className="section__head">
            <h2 id="trust-title" className="h-section">
              {"Guarded in code.\nPrivate by default."}
            </h2>
            <p className="intro">These limits are enforced on every query, on every plan. None of them is a setting you can forget.</p>
          </div>
          <TrustPair
            left={{
              title: "What the guard enforces",
              body: "Each query is checked before it runs and limited while it runs.",
              tiles: [
                { seal: FACTS.blockedOperators.length, sealCaption: "blocked", label: "Write and JS operators", value: "$out, $merge, $where", chip: "Blocked" },
                { seal: FACTS.maxRowsPerQuery, sealCaption: "rows", label: "Rows per query", value: `Up to ${FACTS.maxRowsPerQuery}`, chip: "Capped" },
                { seal: `${FACTS.queryTimeoutS}s`, sealCaption: "limit", label: "Query timeout", value: `${FACTS.queryTimeoutS} seconds`, chip: "Enforced" },
                { seal: "256", sealCaption: "AES-GCM", label: "Connection strings", value: "AES-256-GCM", chip: "Encrypted" },
              ],
            }}
            right={{
              title: "What stays out of reach",
              body: "The model works with the schema and returned rows only. Everything below is kept away from it.",
              feature: {
                icon: <EyeOff />,
                title: "Sensitive fields",
                sub: `${FACTS.redactedFieldPatterns.length} name patterns, at any depth`,
                chip: "Auto-redacted",
              },
              rows: [
                { icon: <Database />, label: "Scope", value: "Only collections you pick" },
                { icon: <ServerOff />, label: "System databases", value: `${FACTS.systemDatabases.join(", ")}: never` },
                { icon: <Layers />, label: FACTS.crossCollectionStages.join(", "), value: "Must stay in scope" },
                { icon: <Binary />, label: "Binary fields", value: "Hidden" },
                { icon: <KeyRound />, label: "Your AI key", value: "Masked in the app" },
              ],
            }}
          />
        </section>

        <section className="container section" aria-label="How a query is checked">
          <SectionHead
            title={"How a query is checked"}
            intro="The exact path every MongoDB query takes, in order. If any step fails, the query does not run and the model is told why."
          />
          <QueryPath />
        </section>

        <section className="container section" aria-label="What the model sees">
          <SectionHead
            title={"What the model sees,\nand what it never does"}
            intro="An AI model writes the query and the explanation. Here is the full list of what it is given."
          />
          <div className="grid w-full gap-4 md:grid-cols-2">
            {[
              { label: "Sent to the model", tone: "sees", items: SEES },
              { label: "Never sent", tone: "never", items: NEVER },
            ].map((col) => (
              <div key={col.label} className="flex flex-col rounded-2xl border border-st bg-sf-white">
                <p className="flex items-center gap-2 border-b border-st-secondary px-6 py-4 text-body font-medium text-tx md:px-8">
                  <span
                    aria-hidden="true"
                    className={
                      col.tone === "sees"
                        ? "grid size-6 place-items-center rounded-full bg-green-100 text-green-700"
                        : "grid size-6 place-items-center rounded-full bg-red-50 text-red-400"
                    }
                  >
                    {col.tone === "sees" ? <Check className="size-3.5" strokeWidth={2.2} /> : <X className="size-3.5" strokeWidth={2.2} />}
                  </span>
                  {col.label}
                </p>
                <ul className="m-0 flex list-none flex-col p-0">
                  {col.items.map((item) => (
                    <li key={item.title} className="grid grid-cols-[40px_1fr] gap-4 border-b border-st-secondary px-6 py-5 last:border-b-0 md:px-8">
                      <span
                        aria-hidden="true"
                        className="grid size-10 place-items-center rounded-xl bg-sf-secondary text-tx-secondary [&_svg]:size-[18px] [&_svg]:stroke-[1.5]"
                      >
                        {item.icon}
                      </span>
                      <span className="flex flex-col gap-1">
                        <span className="text-body font-medium text-tx">{item.title}</span>
                        <span className="text-caption leading-[1.6] text-tx-tertiary">{item.body}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="container section" aria-label="Where your data lives and how your key is handled">
          <SectionHead title={"Where your data lives"} intro="What wuup stores, what it does not, and where your AI key fits in." />
          <div className="grid w-full gap-4 lg:grid-cols-[1.4fr_1fr]">
            <ol className="m-0 grid list-none gap-px overflow-hidden rounded-2xl border border-st bg-st-secondary p-0 sm:grid-cols-2">
              {STORAGE.map((s, i) => (
                <li key={s.title} className="flex flex-col gap-2 bg-sf-white p-6 md:p-8">
                  <span className="font-mono text-label text-indigo-700">0{i + 1}</span>
                  <span className="text-body-lg font-medium leading-[1.35] text-tx">{s.title}</span>
                  <span className="text-caption leading-[1.6] text-tx-tertiary md:text-body">{s.body}</span>
                </li>
              ))}
            </ol>
            <div className="relative flex flex-col overflow-hidden rounded-2xl border border-st bg-sf-white p-6 md:p-8">
              <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-[radial-gradient(circle,rgba(125,211,252,.45),rgba(196,181,253,.25)_45%,transparent_70%)] blur-xl" />
              <span className="relative grid size-12 place-items-center rounded-xl bg-indigo-100 text-indigo-800">
                <KeyRound className="size-6" strokeWidth={1.5} aria-hidden="true" />
              </span>
              <h3 className="relative mt-5 text-heading-4 font-medium leading-[1.3] text-tx">Bring your own key, handled carefully</h3>
              <ul className="relative m-0 mt-5 flex list-none flex-col gap-3 p-0">
                {KEY_FACTS.map((f) => (
                  <li key={f} className="flex gap-3 text-body leading-[1.55] text-tx-secondary">
                    <Check className="mt-1 size-4 shrink-0 text-indigo-600" strokeWidth={2} aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
              <div aria-hidden="true" className="relative mt-6 flex items-center gap-2 rounded-xl border border-st bg-sf px-3 py-2.5 font-mono text-[12.5px] text-tx">
                sk-proj-<span className="tracking-[0.15em] text-tx-muted">••••••••••••</span>a41c
                <span className="ml-auto rounded-full bg-green-100 px-2 py-0.5 font-sans text-[11px] font-medium text-green-700">Saved</span>
              </div>
              <Link href="/byok" className="link-arrow relative mt-6 text-caption">
                How bring your own key works <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <section className="container section" aria-label="What stays your job">
          <SectionHead
            title={"What stays your job"}
            intro="wuup's guard is one lock. These three keep you safe even if something upstream changes."
          />
          <ol className="m-0 grid w-full list-none gap-4 p-0 md:grid-cols-3">
            {YOUR_JOB.map((j, i) => (
              <li key={j.title} className="flex flex-col gap-4 rounded-2xl border border-st-secondary bg-sf-white p-6 md:p-8">
                <span className="flex items-center justify-between">
                  <span
                    aria-hidden="true"
                    className="grid size-11 place-items-center rounded-xl bg-[linear-gradient(180deg,#dbeafe,#eff6ff)] text-blue-700 shadow-[inset_0_0_0_1px_var(--blue-100)] [&_svg]:size-5 [&_svg]:stroke-[1.5]"
                  >
                    {j.icon}
                  </span>
                  <span className="grid size-6 place-items-center rounded-md border border-st text-label text-tx-tertiary" aria-hidden="true">
                    {i + 1}
                  </span>
                </span>
                <span className="text-heading-card font-medium leading-[1.3] text-tx">{j.title}</span>
                <span className="text-body leading-[1.6] text-tx-tertiary">{j.body}</span>
                {j.link ? (
                  <Link href={j.link.href} className="link-arrow mt-auto text-caption">
                    <BookOpen className="size-4" aria-hidden="true" />
                    {j.link.label}
                  </Link>
                ) : null}
              </li>
            ))}
          </ol>
        </section>

        {faqs.length ? <FaqSection title={"Security questions,\nanswered"} items={faqs} /> : null}

        <CtaBand
          title={"Read-only by design.\nReady when you are."}
          secondary={{ label: "Read-only user guide", href: "/guides/mongodb-read-only-user" }}
        />
      </InnerSheet>
      <PageSheetEnd className="md:-mt-12" />
    </>
  );
}
