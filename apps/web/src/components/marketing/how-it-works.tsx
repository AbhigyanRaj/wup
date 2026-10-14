import { Check, Code2, EyeOff, Globe, KeyRound, Lock, MessageCircleQuestion, Plug } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { HAccordion, type HAccordionItem } from "@/components/ui/h-accordion";
import { Eyebrow } from "@/components/ui/section";
import { FACTS } from "@/lib/site";
import { cn } from "@/lib/cn";
import { BarChart, Cite, FollowUps, WuupAvatar } from "./answer-mock";

/*
 * Kit "eyebrow + left heading + horizontal accordion" (home.md §4), used for
 * wuup's five-step flow. Each open panel gets a blue-family glow rising from
 * the bottom-left and a coded mini mock of that step in the white frame.
 */

function MockShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("h-full w-full bg-sf-white p-5 text-left md:p-7", className)}>{children}</div>;
}

function ConnectMock() {
  return (
    <MockShell>
      <p className="text-[13px] font-medium text-tx">New connection</p>
      <div className="mt-4 grid max-w-[520px] grid-cols-3 gap-2">
        {[
          ["/logos/mongodb.svg", "MongoDB", true],
          ["/logos/google-sheets.svg", "Google Sheets", false],
          ["/logos/pdf.svg", "Documents", false],
        ].map(([logo, name, on]) => (
          <div
            key={name as string}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[12.5px]",
              on ? "border-indigo-200 bg-indigo-50 text-indigo-800" : "border-st-secondary text-tx-secondary",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- static icon */}
            <img src={logo as string} alt="" width={14} height={14} className="size-3.5" />
            {name}
          </div>
        ))}
      </div>
      <p className="mt-5 text-[11.5px] font-medium text-tx-secondary">Connection string</p>
      <div className="mt-1.5 flex max-w-[520px] items-center gap-2 rounded-full border border-st px-4 py-2.5 font-mono text-[11.5px] text-tx-secondary">
        <span className="truncate">mongodb+srv://analyst:••••••••@shop.x1ab.mongodb.net/shop</span>
        <Lock className="ml-auto size-3.5 shrink-0 text-tx-muted" aria-hidden="true" />
      </div>
      <div className="mt-4 flex max-w-[520px] items-center gap-2 text-[12px]">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-green-700">
          <Check className="size-3.5" aria-hidden="true" /> Connected · 6 collections found
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-800">
          <KeyRound className="size-3.5" aria-hidden="true" /> Encrypted at rest
        </span>
      </div>
    </MockShell>
  );
}

function ScopeMock() {
  const cols: Array<[string, string, boolean]> = [
    ["orders", "48,210 docs", true],
    ["customers", "9,874 docs", true],
    ["products", "1,120 docs", true],
    ["users", "12,402 docs", false],
    ["sessions", "1.2M docs", false],
  ];
  return (
    <MockShell>
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-tx">Collections wuup may read</p>
        <span className="text-[11.5px] text-tx-muted">3 of 6 selected</span>
      </div>
      <ul className="mt-3 max-w-[560px] divide-y divide-st-secondary rounded-xl border border-st-secondary">
        {cols.map(([name, meta, on]) => (
          <li key={name} className="flex items-center gap-3 px-3.5 py-2 text-[12.5px]">
            <span
              className={cn(
                "grid size-4 place-items-center rounded-[5px] border",
                on ? "border-ink bg-ink text-white" : "border-st bg-sf-white",
              )}
            >
              {on ? <Check className="size-3" strokeWidth={3} aria-hidden="true" /> : null}
            </span>
            <span className="font-mono text-tx">{name}</span>
            <span className="ml-auto text-tx-muted">{meta}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex max-w-[560px] flex-wrap items-center gap-1.5 text-[11.5px]">
        <span className="inline-flex items-center gap-1 text-tx-tertiary">
          <EyeOff className="size-3.5" aria-hidden="true" /> Hidden from the model:
        </span>
        {["password", "token", "card_number", "otp"].map((f) => (
          <span key={f} className="rounded-md border border-st bg-sf-secondary px-1.5 py-0.5 font-mono text-tx-secondary line-through decoration-tx-muted">
            {f}
          </span>
        ))}
      </div>
    </MockShell>
  );
}

function AskMock() {
  return (
    <MockShell className="flex flex-col gap-3">
      <div className="flex justify-end">
        <p className="rounded-2xl rounded-br-md bg-[#DBEAFE] px-3.5 py-2 text-[12.5px] text-[#1e2a4a]">Revenue by month for 2026?</p>
      </div>
      <div className="flex items-center gap-2">
        <WuupAvatar size={20} />
        <span className="text-[12px] text-tx-muted">Running orders.aggregate...</span>
      </div>
      <p className="max-w-[560px] text-[12.5px] leading-[1.6] text-tx-secondary">
        Revenue rose every month to a May peak of ₹41.8L <Cite n={1} />. March grew fastest
        <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse bg-indigo-600 align-middle" />
      </p>
      <div className="max-w-[420px] rounded-xl border border-st-secondary p-3">
        <BarChart
          height={110}
          highlight={2}
          format={(v) => `₹${v.toFixed(0)}L`}
          data={[
            { label: "Jan", value: 21.4 },
            { label: "Feb", value: 24.9 },
            { label: "Mar", value: 32.6 },
            { label: "Apr", value: 36.1 },
            { label: "May", value: 41.8 },
            { label: "Jun", value: 39.2 },
          ]}
        />
      </div>
    </MockShell>
  );
}

function VerifyMock() {
  return (
    <MockShell>
      <div className="max-w-[580px] overflow-hidden rounded-xl border border-st">
        <div className="flex items-center gap-2 border-b border-st bg-sf-tertiary px-3 py-2 text-[11.5px]">
          <Code2 className="size-3.5" aria-hidden="true" />
          <span className="font-medium text-tx">Queries used</span>
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">read-only</span>
          <span className="ml-auto text-tx-muted">2 queries</span>
        </div>
        <pre className="overflow-hidden bg-[#fafafa] px-4 py-3 font-mono text-[11px] leading-[1.7] text-tx">
          <span className="tok-com">{"// 1 · orders · 6 rows · 38 ms"}</span>
          {"\n"}
          <span className="tok-fn">db</span>.orders.<span className="tok-fn">aggregate</span>([{"\n"}
          {"  { "}<span className="tok-kw">$match</span>
          {": { status: "}
          <span className="tok-str">&quot;paid&quot;</span>
          {" } },\n  { "}
          <span className="tok-kw">$group</span>
          {": { _id: { "}
          <span className="tok-kw">$month</span>
          {": "}
          <span className="tok-str">&quot;$createdAt&quot;</span>
          {" },\n             revenue: { "}
          <span className="tok-kw">$sum</span>
          {": "}
          <span className="tok-str">&quot;$amount&quot;</span>
          {" } } },\n  { "}
          <span className="tok-kw">$sort</span>
          {": { _id: "}
          <span className="tok-const">1</span>
          {" } }\n])"}
        </pre>
      </div>
      <p className="mt-3 text-[11.5px] text-tx-muted">
        Capped at {FACTS.maxRowsPerQuery} rows and {FACTS.queryTimeoutS}s. Copy it into mongosh to run it yourself.
      </p>
    </MockShell>
  );
}

function DeeperMock() {
  return (
    <MockShell className="flex flex-col gap-4">
      <div className="max-w-[540px] rounded-xl border border-indigo-200 bg-indigo-50/60 p-3.5">
        <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-indigo-900">
          <MessageCircleQuestion className="size-4" aria-hidden="true" /> Which revenue do you mean?
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {["Gross, before refunds", "Net of refunds", "Paid orders only"].map((o, i) => (
            <span
              key={o}
              className={cn(
                "rounded-full border px-3 py-1 text-[12px]",
                i === 1 ? "border-indigo-300 bg-sf-white text-indigo-800" : "border-st bg-sf-white text-tx-secondary",
              )}
            >
              {o}
            </span>
          ))}
        </div>
      </div>
      <FollowUps items={["Break May down by city", "Compare with 2025", "Top products in March"]} className="max-w-[560px]" />
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-st px-3 py-1.5 text-[12px] text-tx-secondary">
        <Globe className="size-3.5" aria-hidden="true" /> Search the web
        <span className="ml-1 inline-flex h-4 w-7 items-center rounded-full bg-ink p-0.5">
          <span className="ml-auto size-3 rounded-full bg-white" />
        </span>
      </span>
    </MockShell>
  );
}

const ITEMS: HAccordionItem[] = [
  {
    id: "connect",
    label: "Connect",
    title: "Connect",
    body: "Paste a MongoDB URI, share a Sheet or upload a PDF. Connection details are encrypted before they are stored.",
    art: { a: "#2563eb", b: "#bfdbfe" },
    media: <ConnectMock />,
  },
  {
    id: "scope",
    label: "Scope",
    title: "Scope",
    body: "Pick the collections wuup may read. Fields like password, token and card_number are hidden automatically.",
    art: { a: "#38bdf8", b: "#e0f2fe" },
    media: <ScopeMock />,
  },
  {
    id: "ask",
    label: "Ask",
    title: "Ask",
    body: "Type a question. The answer streams in with a table or chart built from the returned rows.",
    art: { a: "#556adc", b: "#e8effc" },
    media: <AskMock />,
  },
  {
    id: "verify",
    label: "Verify",
    title: "Verify",
    body: "Open Queries used to see every find and aggregate that ran.",
    art: { a: "#0b5cff", b: "#c4b5fd" },
    media: <VerifyMock />,
  },
  {
    id: "deeper",
    label: "Go deeper",
    title: "Go deeper",
    body: "Follow-ups, clarifying questions and optional web search keep the thread moving.",
    art: { a: "#818cf8", b: "#dbeafe" },
    media: <DeeperMock />,
  },
];

export function HowItWorks() {
  return (
    <section className="container" aria-labelledby="how-title">
      <div className="row-between mb-10 md:mb-14">
        <div className="max-w-[640px]">
          <Eyebrow>How it works</Eyebrow>
          <h2 id="how-title" className="h-section mt-5 md:mt-6">
            {"From connection string\nto a cited answer"}
          </h2>
          <p className="mt-4 text-[16px] leading-[1.6] text-tx-secondary md:mt-5 md:text-[18px]">
            Five steps from a connection string to an answer you can check. wuup reads your schema, writes the query, runs it read-only and shows its work.
          </p>
        </div>
        <ButtonLink href="/features" variant="soft" className="w-fit shrink-0" leadingIcon={<Plug className="size-4" aria-hidden="true" />}>
          See every feature
        </ButtonLink>
      </div>
      <HAccordion items={ITEMS} defaultValue="connect" />
    </section>
  );
}
