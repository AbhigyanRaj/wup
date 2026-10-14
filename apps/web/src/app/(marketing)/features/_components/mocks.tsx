import type { ReactNode } from "react";
import {
  Check,
  ChevronDown,
  CircleCheck,
  Code2,
  Copy,
  Database,
  EyeOff,
  FileText,
  Globe,
  KeyRound,
  Loader2,
  Search,
  ShieldCheck,
  MessageCircleQuestion,
} from "lucide-react";
import {
  AssistantHead,
  BarChart,
  Cite,
  FollowUps,
  LineChart,
  MiniTable,
  MockCard,
  MockWindow,
  UserBubble,
} from "@/components/marketing/answer-mock";
import { FACTS } from "@/lib/site";
import { cn } from "@/lib/cn";

/*
 * Coded product mocks for /features: the four stepper panels (Connect, Scope,
 * Ask, Verify) and one inset per feature-tour card. Static server markup that
 * mirrors the real app. All names and numbers are sample data.
 */

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

function Logo({ src, size = 16 }: { src: string; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element -- tiny static brand svg
  return <img src={src} alt="" width={size} height={size} style={{ width: size, height: size }} />;
}

function Tag({ tone = "neutral", children }: { tone?: "neutral" | "green" | "indigo" | "sky"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-medium leading-4",
        tone === "green" && "bg-green-100 text-green-700",
        tone === "indigo" && "bg-indigo-100 text-indigo-800",
        tone === "sky" && "bg-sky-100 text-sky-700",
        tone === "neutral" && "bg-sf-tertiary text-tx-tertiary",
      )}
    >
      {children}
    </span>
  );
}

function PanelShell({ title, crumbs, children }: { title: string; crumbs: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[460px] flex-col text-left md:min-h-[520px]" aria-hidden="true">
      <div className="flex h-11 shrink-0 items-center gap-3 border-b border-st-secondary bg-sf px-4">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-[#e6e6e6]" />
          <span className="size-2.5 rounded-full bg-[#e6e6e6]" />
          <span className="size-2.5 rounded-full bg-[#e6e6e6]" />
        </span>
        <span className="truncate text-[12px] text-tx-muted">{crumbs}</span>
        <span className="ml-auto truncate text-[12.5px] font-medium text-tx">{title}</span>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stepper panels                                                      */
/* ------------------------------------------------------------------ */

export function ConnectPanel() {
  return (
    <PanelShell title="Add a data source" crumbs="Data / New source">
      <div className="grid flex-1 gap-4 md:grid-cols-[220px_1fr]">
        <div className="hidden gap-2 md:flex md:flex-col">
          {[
            ["/logos/mongodb.svg", "MongoDB", "Read-only queries", true],
            ["/logos/google-sheets.svg", "Google Sheets", "Service account", false],
            ["/logos/pdf.svg", "Documents", "PDF and TXT", false],
          ].map(([logo, name, sub, on]) => (
            <div
              key={name as string}
              className={cn(
                "flex flex-1 items-center gap-3 rounded-xl border px-3 py-2.5 md:flex-none",
                on ? "border-indigo-200 bg-indigo-50 shadow-[0_0_0_3px_rgba(165,187,252,.18)]" : "border-st-secondary bg-sf-white",
              )}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-st-secondary bg-sf-white">
                <Logo src={logo as string} />
              </span>
              <span className="hidden min-w-0 flex-col sm:flex">
                <span className="text-[13px] font-medium text-tx">{name}</span>
                <span className="truncate text-[11px] text-tx-tertiary">{sub}</span>
              </span>
            </div>
          ))}
          <div className="hidden flex-col gap-1 rounded-xl border border-dashed border-st px-3 py-2.5 md:flex">
            <span className="text-[12px] font-medium text-tx-tertiary">SQL databases</span>
            <span className="text-[11px] text-tx-muted">On the roadmap</span>
          </div>
          <div className="mt-auto hidden rounded-xl bg-sf-secondary p-3 text-[11px] leading-[1.5] text-tx-tertiary md:block">
            <p className="mb-1 font-medium text-tx-secondary">Tip</p>
            Create a user with the read role on one database. wuup never needs more.
          </div>
        </div>

        <div className="flex flex-col gap-3.5 rounded-2xl border border-st-secondary bg-sf-white p-4 md:p-5">
          <div className="flex items-center gap-2">
            <Logo src="/logos/mongodb.svg" size={18} />
            <p className="text-[15px] font-medium text-tx">Connect MongoDB</p>
            <Tag tone="green">
              <ShieldCheck className="size-3" /> read-only
            </Tag>
          </div>
          <div className="grid gap-3 sm:grid-cols-[0.6fr_1fr]">
            <div className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-medium text-tx-secondary">Name</span>
              <span className="rounded-xl border border-st bg-sf-white px-3 py-2 text-[12.5px] text-tx">shop-prod</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-medium text-tx-secondary">Connection string</span>
              <span className="truncate rounded-xl border border-indigo-300 bg-sf-white px-3 py-2 font-mono text-[11.5px] text-tx shadow-[0_0_0_3px_rgba(165,187,252,.18)]">
                mongodb+srv://readonly:<span className="text-tx-muted">••••••••</span>@cluster0.mongodb.net/shop
              </span>
            </div>
          </div>
          <p className="flex items-start gap-2 rounded-xl bg-sf-secondary px-3 py-2 text-[11.5px] leading-[1.5] text-tx-tertiary">
            <ShieldCheck className="mt-px size-3.5 shrink-0 text-indigo-700" />
            Use a database user with the read role only. The string is encrypted before it is stored.
          </p>
          <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-[12px] text-green-800">
            <CircleCheck className="size-4 shrink-0 text-green-600" />
            <span className="font-medium">Connected</span>
            <span className="truncate text-green-700">6 collections found, 41 ms</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-tx-muted">Scanning schema</p>
            {[
              ["orders", "18 fields", "done"],
              ["customers", "11 fields", "done"],
              ["products", "9 fields", "done"],
              ["reviews", "sampling documents", "run"],
            ].map(([c, meta, state]) => (
              <div key={c} className="flex items-center gap-2 text-[12px]">
                {state === "done" ? (
                  <Check className="size-3.5 text-green-600" />
                ) : (
                  <Loader2 className="size-3.5 animate-spin text-indigo-600 motion-reduce:animate-none" />
                )}
                <span className="font-mono text-[11.5px] text-tx">{c}</span>
                <span className="text-tx-muted">{meta}</span>
              </div>
            ))}
          </div>
          <div className="mt-auto flex justify-end gap-2">
            <span className="rounded-full bg-sf-secondary px-4 py-1.5 text-[12.5px] font-medium text-tx">Test again</span>
            <span className="rounded-full bg-ink px-4 py-1.5 text-[12.5px] font-medium text-white shadow-btn-ink">Continue</span>
          </div>
        </div>
      </div>
    </PanelShell>
  );
}

export function ScopePanel() {
  const cols: Array<[string, string, boolean]> = [
    ["orders", "48,210", true],
    ["customers", "9,874", true],
    ["products", "612", true],
    ["reviews", "21,904", true],
    ["sessions", "1.2M", false],
    ["audit_logs", "310K", false],
  ];
  const fields: Array<[string, string, boolean]> = [
    ["_id", "objectId", false],
    ["name", "string", false],
    ["city", "string", false],
    ["createdAt", "date", false],
    ["passwordHash", "string", true],
    ["apiToken", "string", true],
    ["orderCount", "number", false],
  ];
  return (
    <PanelShell title="Choose what wuup may read" crumbs="Data / shop-prod / Scope">
      <div className="grid flex-1 gap-4 md:grid-cols-[1fr_1.15fr]">
        <div className="flex flex-col rounded-2xl border border-st-secondary bg-sf-white">
          <div className="flex items-center justify-between border-b border-st-secondary px-4 py-3">
            <p className="text-[13px] font-medium text-tx">Collections</p>
            <span className="text-[11px] text-tx-muted">documents</span>
          </div>
          {cols.map(([name, count, on]) => (
            <div key={name} className={cn("flex items-center gap-3 border-b border-st-secondary px-4 py-2.5 last:border-b-0", name === "customers" && "bg-indigo-50/60")}>
              <span
                className={cn(
                  "grid size-[18px] place-items-center rounded-[5px] border",
                  on ? "border-ink-auth bg-ink-auth text-white" : "border-st bg-sf-white",
                )}
              >
                {on ? <Check className="size-3" strokeWidth={2.5} /> : null}
              </span>
              <span className={cn("font-mono text-[12px]", on ? "text-tx" : "text-tx-muted")}>{name}</span>
              <span className="ml-auto text-[11.5px] tabular-nums text-tx-muted">{count}</span>
            </div>
          ))}
          <div className="mt-auto flex items-center justify-between gap-2 rounded-b-2xl bg-sf px-4 py-3 text-[11.5px]">
            <span className="text-tx-tertiary">4 of 6 in scope</span>
            <Tag tone="indigo">Queries stay inside these</Tag>
          </div>
        </div>

        <div className="flex flex-col rounded-2xl border border-st-secondary bg-sf-white">
          <div className="flex items-center gap-2 border-b border-st-secondary px-4 py-3">
            <Database className="size-3.5 text-tx-tertiary" />
            <p className="font-mono text-[12.5px] text-tx">customers</p>
            <span className="ml-auto text-[11px] text-tx-muted">schema, sampled</span>
          </div>
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 px-4 pt-2 text-[10px] font-medium uppercase tracking-[0.08em] text-tx-muted">
            <span>Field</span>
            <span>Type</span>
            <span className="w-[74px] text-right">AI sees</span>
          </div>
          {fields.map(([f, t, hidden]) => (
            <div key={f} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 border-b border-st-secondary px-4 py-2 last:border-b-0">
              <span className={cn("font-mono text-[12px]", hidden ? "text-tx-muted line-through decoration-tx-muted/50" : "text-tx")}>{f}</span>
              <span className="font-mono text-[11px] text-tx-tertiary">{t}</span>
              <span className="flex w-[74px] justify-end">
                {hidden ? (
                  <Tag>
                    <EyeOff className="size-3" /> Hidden
                  </Tag>
                ) : (
                  <Check className="size-3.5 text-green-600" />
                )}
              </span>
            </div>
          ))}
          <p className="mt-auto rounded-b-2xl bg-sf px-4 py-3 text-[11.5px] leading-[1.5] text-tx-tertiary">
            Sensitive names are hidden automatically, at any depth. You can hide more.
          </p>
        </div>
      </div>
    </PanelShell>
  );
}

const DELIVERY = [
  { label: "Delhi", value: 2.4 },
  { label: "Mumbai", value: 2.2 },
  { label: "Pune", value: 3.1 },
  { label: "Bengaluru", value: 2.9 },
  { label: "Jaipur", value: 4.6 },
  { label: "Kochi", value: 3.8 },
];

export function AskPanel() {
  return (
    <div aria-hidden="true" className="flex min-h-[460px] md:min-h-[520px]">
      <MockWindow
        title="Slowest delivery cities"
        activeChat={1}
        className="rounded-none border-0 shadow-none"
        source={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-st bg-sf-white px-2.5 py-1 text-[11.5px] text-tx-secondary">
            <Logo src="/logos/mongodb.svg" size={12} /> shop-prod
          </span>
        }
      >
        <UserBubble>Which cities had the slowest average delivery last month?</UserBubble>
        <div className="flex flex-col gap-3">
          <AssistantHead meta="from 1 query on orders" />
          <p className="text-[13.5px] leading-[1.6] text-tx-secondary">
            <b className="font-medium text-tx">Jaipur</b> was slowest at <b className="font-medium text-tx">4.6 days</b> on average <Cite n={1} />,
            followed by Kochi at 3.8 days. Mumbai was fastest at 2.2 days
            <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse bg-indigo-600 motion-reduce:animate-none" />
          </p>
          <MockCard title="Average delivery time, September" meta="orders · 6 rows">
            <BarChart data={DELIVERY} highlight={4} format={(v) => `${v.toFixed(1)}d`} height={120} />
          </MockCard>
          <FollowUps items={["Which couriers serve Jaipur?", "Compare with August", "Show orders over 7 days"]} />
        </div>
      </MockWindow>
    </div>
  );
}

export function VerifyPanel() {
  return (
    <PanelShell title="Queries used" crumbs="Chat / Slowest delivery cities">
      <div className="grid flex-1 gap-4 md:grid-cols-[1.35fr_1fr]">
        <div className="flex flex-col overflow-hidden rounded-2xl border border-st">
          <div className="flex items-center gap-2 border-b border-st bg-sf-tertiary px-3 py-2 text-[11.5px]">
            <Code2 className="size-3.5 text-tx-secondary" />
            <span className="font-medium text-tx">Query 1</span>
            <span className="font-mono text-tx-tertiary">orders.aggregate</span>
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-sf-white px-2 py-0.5 text-tx-secondary">
              <Copy className="size-3" /> Copy
            </span>
          </div>
          <pre className="flex-1 overflow-hidden bg-[#fafafa] px-4 py-3 font-mono text-[11.5px] leading-[1.75] text-tx">
            <span className="tok-fn">db</span>.<span className="tok-fn">orders</span>.<span className="tok-fn">aggregate</span>([{"\n"}
            {"  { "}<span className="tok-kw">$match</span>{": { status: "}<span className="tok-str">&quot;delivered&quot;</span>,{"\n"}
            {"      deliveredAt: { "}<span className="tok-kw">$gte</span>: <span className="tok-fn">ISODate</span>(<span className="tok-str">&quot;2026-09-01&quot;</span>),{"\n"}
            {"                     "}<span className="tok-kw">$lt</span>: <span className="tok-fn">ISODate</span>(<span className="tok-str">&quot;2026-10-01&quot;</span>) {"} } },"}{"\n"}
            {"  { "}<span className="tok-kw">$group</span>{": { _id: "}<span className="tok-str">&quot;$shipping.city&quot;</span>,{"\n"}
            {"      avgDays: { "}<span className="tok-kw">$avg</span>: <span className="tok-str">&quot;$deliveryDays&quot;</span> {"} } },"}{"\n"}
            {"  { "}<span className="tok-kw">$sort</span>{": { avgDays: "}<span className="tok-const">-1</span>{" } },"}{"\n"}
            {"  { "}<span className="tok-kw">$limit</span>: <span className="tok-const">{FACTS.maxRowsPerQuery}</span>{" }"}{"\n"}])
          </pre>
          <div className="border-t border-st-secondary bg-sf-white px-3 py-2.5">
            <MiniTable
              columns={["City", "Avg days", "Orders"]}
              numeric={[1, 2]}
              highlightRow={0}
              rows={[
                ["Jaipur", "4.6", "1,118"],
                ["Kochi", "3.8", "842"],
                ["Pune", "3.1", "2,403"],
              ]}
            />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl border border-st-secondary bg-sf-white p-4">
            <p className="mb-3 flex items-center gap-2 text-[13px] font-medium text-tx">
              <ShieldCheck className="size-4 text-indigo-700" /> Checks before it ran
            </p>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {[
                ["Read-only stages", "no $out, $merge or $where"],
                ["Collection in scope", "orders"],
                ["Row cap", `6 of ${FACTS.maxRowsPerQuery}`],
                ["Time limit", `38 ms of ${FACTS.queryTimeoutS} s`],
                ["Hidden fields", "removed from rows"],
              ].map(([k, v]) => (
                <li key={k} className="flex items-start gap-2 text-[12px]">
                  <CircleCheck className="mt-px size-3.5 shrink-0 text-green-600" />
                  <span className="text-tx-secondary">{k}</span>
                  <span className="ml-auto text-right font-mono text-[11px] text-tx-tertiary">{v}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
            <p className="text-[12px] font-medium text-indigo-900">Run it yourself</p>
            <p className="mt-1 text-[11.5px] leading-[1.55] text-indigo-800/80">
              Paste the query into mongosh or Compass. Same rows, same answer.
            </p>
          </div>
        </div>
      </div>
    </PanelShell>
  );
}

/* ------------------------------------------------------------------ */
/* Feature tour insets                                                 */
/* ------------------------------------------------------------------ */

function InsetHead({ icon, title, meta }: { icon: ReactNode; title: string; meta?: ReactNode }) {
  return (
    <div className="flex h-10 items-center gap-2 border-b border-st-secondary px-4 text-[12px]">
      <span className="text-tx-tertiary [&_svg]:size-3.5">{icon}</span>
      <span className="font-medium text-tx">{title}</span>
      {meta ? <span className="ml-auto flex items-center gap-1.5 text-tx-muted">{meta}</span> : null}
    </div>
  );
}

export function ChartsInset() {
  return (
    <div aria-hidden="true" className="flex h-full flex-col text-left">
      <InsetHead icon={<Database />} title="Weekly paid orders" meta={<Tag tone="indigo">built from 12 rows</Tag>} />
      <div className="grid flex-1 gap-3 p-3 md:grid-cols-[1.4fr_1fr] md:p-4">
        <div className="flex flex-col gap-3">
        <MockCard title="Paid orders per week" meta="orders · since 7 Jul">
          <LineChart
            height={150}
            labels={["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8", "W9", "W10", "W11", "W12"]}
            series={[{ name: "Orders", color: "var(--chart-1)", values: [812, 860, 845, 902, 958, 1011, 990, 1064, 1102, 1150, 1138, 1206] }]}
          />
        </MockCard>
        <div className="grid grid-cols-3 gap-2">
          {[
            ["Last week", "1,206"],
            ["12-week change", "+49%"],
            ["Rows used", "12"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-st-secondary bg-sf px-3 py-2">
              <p className="text-[10.5px] text-tx-muted">{k}</p>
              <p className="text-[15px] font-medium tabular-nums tracking-[-0.01em] text-tx">{v}</p>
            </div>
          ))}
        </div>
        </div>
        <MockCard title="Rows returned" meta="12 of 12" className="hidden md:block">
          <MiniTable
            columns={["Week", "Orders"]}
            numeric={[1]}
            highlightRow={11}
            rows={[
              ["W7", "990"],
              ["W8", "1,064"],
              ["W9", "1,102"],
              ["W10", "1,150"],
              ["W11", "1,138"],
              ["W12", "1,206"],
            ]}
          />
        </MockCard>
      </div>
    </div>
  );
}

export function QueriesInset() {
  return (
    <div aria-hidden="true" className="flex h-full flex-col text-left">
      <div className="flex items-center gap-1 border-b border-st bg-sf-tertiary px-2 pt-2 text-[11.5px]">
        <span className="rounded-t-lg bg-sf-white px-3 py-1.5 font-medium text-tx shadow-[inset_0_2px_0_var(--indigo-600)]">Query 1 · customers</span>
        <span className="px-3 py-1.5 text-tx-tertiary">Query 2 · orders</span>
        <span className="ml-auto mb-1 inline-flex items-center gap-1 rounded-full bg-sf-white px-2 py-0.5 text-tx-secondary">
          <Copy className="size-3" /> Copy
        </span>
      </div>
      <pre className="overflow-hidden bg-[#fafafa] px-4 py-3 font-mono text-[11.5px] leading-[1.75] text-tx md:text-[12px]">
        <span className="tok-fn">db</span>.<span className="tok-fn">customers</span>.<span className="tok-fn">find</span>({"\n"}
        {"  { city: "}<span className="tok-str">&quot;Pune&quot;</span>, createdAt: {"{ "}<span className="tok-kw">$gte</span>: <span className="tok-fn">ISODate</span>(<span className="tok-str">&quot;2026-07-01&quot;</span>) {"} },"}{"\n"}
        {"  { name: "}<span className="tok-const">1</span>, orderCount: <span className="tok-const">1</span>, createdAt: <span className="tok-const">1</span>{" }"}{"\n"}
        ).<span className="tok-fn">sort</span>({"{ orderCount: "}<span className="tok-const">-1</span>{" }"}).<span className="tok-fn">limit</span>(<span className="tok-const">20</span>){"\n"}
        <span className="tok-com">{"// 20 rows · 29 ms · read-only"}</span>
      </pre>
      <div className="flex flex-wrap items-center gap-2 border-t border-st-secondary px-4 py-2.5 text-[11px]">
        <Tag tone="green">
          <ShieldCheck className="size-3" /> read-only
        </Tag>
        <Tag>in scope: customers</Tag>
        <Tag>{`cap ${FACTS.maxRowsPerQuery} rows`}</Tag>
        <Tag>{`timeout ${FACTS.queryTimeoutS} s`}</Tag>
      </div>
      <div className="border-t border-st-secondary px-4 py-3">
        <MiniTable
          columns={["Name", "Orders", "Since"]}
          numeric={[1]}
          highlightRow={0}
          rows={[
            ["Aarav Mehta", 41, "Jul 2026"],
            ["Ishita Rao", 37, "Aug 2026"],
            ["Kabir Shah", 33, "Jul 2026"],
          ]}
        />
      </div>
    </div>
  );
}

export function DocsInset() {
  return (
    <div aria-hidden="true" className="flex h-full flex-col gap-3 p-3 text-left md:p-4">
      <UserBubble>What notice period does the office lease require?</UserBubble>
      <AssistantHead meta="from 2 documents" />
      <p className="text-[13px] leading-[1.6] text-tx-secondary">
        Either side must give <b className="font-medium text-tx">90 days&apos; written notice</b> <Cite n={1} />. Notice sent before 1 January
        ends the lease on 31 March <Cite n={2} />.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {[
          ["office-lease-2025.pdf", "p. 7, §12.1", "“...ninety (90) days’ written notice to the other party.”"],
          ["lease-addendum.pdf", "p. 2, §3", "“...the term shall end on 31 March of the following year.”"],
        ].map(([file, where, quote], i) => (
          <div key={file} className="flex flex-col gap-1.5 rounded-xl border border-st-secondary bg-sf-white p-3">
            <div className="flex items-center gap-1.5">
              <Cite n={i + 1} />
              <FileText className="size-3.5 text-tx-tertiary" strokeWidth={1.75} />
              <span className="truncate text-[11.5px] font-medium text-tx">{file}</span>
              <span className="ml-auto shrink-0 text-[10.5px] text-tx-muted">{where}</span>
            </div>
            <p className="border-l-2 border-indigo-200 pl-2 text-[11.5px] leading-[1.5] text-tx-secondary">{quote}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-col rounded-xl border border-st-secondary bg-sf">
        <p className="px-3 pt-2.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-tx-muted">Knowledge base</p>
        {[
          ["office-lease-2025.pdf", "24 pages"],
          ["lease-addendum.pdf", "3 pages"],
          ["facilities-notes.txt", "8 KB"],
        ].map(([f, m]) => (
          <div key={f} className="flex items-center gap-2 border-b border-st-secondary px-3 py-2 text-[11.5px] last:border-b-0">
            <FileText className="size-3.5 text-tx-tertiary" strokeWidth={1.75} />
            <span className="truncate text-tx">{f}</span>
            <span className="text-tx-muted">{m}</span>
            <span className="ml-auto">
              <Tag tone="green">Ready</Tag>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ClarifyInset() {
  return (
    <div aria-hidden="true" className="flex h-full flex-col gap-3 p-3 text-left md:p-4">
      <UserBubble>How did revenue do last quarter?</UserBubble>
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-3.5 md:p-4">
        <p className="flex items-center gap-2 text-[12.5px] font-medium text-indigo-900">
          <MessageCircleQuestion className="size-3.5 text-indigo-600" /> Quick question first
        </p>
        <p className="mt-1.5 text-[13px] text-tx">Which revenue do you mean?</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {["Gross, before refunds", "Net, after refunds", "Paid orders only"].map((o, i) => (
            <span
              key={o}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[12px]",
                i === 1 ? "border-indigo-300 bg-sf-white text-indigo-800 shadow-[0_0_0_3px_rgba(165,187,252,.2)]" : "border-st bg-sf-white text-tx-secondary",
              )}
            >
              {o}
            </span>
          ))}
        </div>
        <div className="mt-2.5 rounded-xl border border-st bg-sf-white px-3 py-2 text-[12px] text-tx-muted">Or type your own...</div>
      </div>
      <p className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-tx-muted">After the answer</p>
      <FollowUps items={["Split it by month", "Which products drove it?", "Compare with Q2"]} />
    </div>
  );
}

export function WebInset() {
  return (
    <div aria-hidden="true" className="flex h-full flex-col gap-3 p-3 text-left md:p-4">
      <UserBubble>What is net revenue retention, and what was ours in Q3?</UserBubble>
      <div className="flex items-center gap-2">
        <AssistantHead meta="your data + 2 web sources" />
        <span className="ml-auto hidden items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10.5px] text-indigo-800 sm:inline-flex">
          <Globe className="size-3" /> Web on
        </span>
      </div>
      <p className="text-[13px] leading-[1.6] text-tx-secondary">
        Net revenue retention compares revenue from existing customers now with the same customers a year ago <Cite n={2} />. Yours was{" "}
        <b className="font-medium text-tx">108% in Q3</b>, up from 101% in Q2 <Cite n={1} />.
      </p>
      <div className="flex flex-col gap-1.5">
        {[
          ["Data", "Q3 revenue sheet, Accounts tab", "sky", "/logos/google-sheets.svg"],
          ["Web", "Glossary article on retention metrics", "neutral", ""],
          ["Web", "Guide to SaaS revenue metrics", "neutral", ""],
        ].map(([kind, title, tone, logo], i) => (
          <div key={title} className="flex items-center gap-2 rounded-xl border border-st-secondary bg-sf-white px-3 py-2 text-[12px]">
            <Cite n={i + 1} />
            {logo ? <Logo src={logo} size={13} /> : <Search className="size-3.5 text-tx-tertiary" />}
            <span className="truncate text-tx">{title}</span>
            <span className="ml-auto">
              <Tag tone={tone as "sky" | "neutral"}>{kind}</Tag>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ResearchInset() {
  return (
    <div aria-hidden="true" className="flex h-full flex-col gap-3 p-3 text-left md:p-4">
      <UserBubble>Why did repeat purchases drop in September?</UserBubble>
      <div className="rounded-2xl border border-st-secondary bg-sf-white p-3.5">
        <p className="mb-2.5 text-[12.5px] font-medium text-tx">Research plan</p>
        {[
          ["Repeat rate by month", "done"],
          ["Repeat buyers by city", "done"],
          ["Delivery times for repeat buyers", "run"],
          ["Write the report", "wait"],
        ].map(([s, st], i) => (
          <div key={s} className="flex items-center gap-2.5 py-1 text-[12px]">
            <span className="grid size-5 place-items-center rounded-full bg-indigo-100 text-[10px] font-medium text-indigo-800">{i + 1}</span>
            <span className={cn(st === "wait" ? "text-tx-muted" : "text-tx-secondary")}>{s}</span>
            <span className="ml-auto">
              {st === "done" ? <Check className="size-3.5 text-green-600" /> : st === "run" ? <Loader2 className="size-3.5 animate-spin text-indigo-600 motion-reduce:animate-none" /> : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function KeyInset() {
  return (
    <div aria-hidden="true" className="flex h-full flex-col text-left">
      <InsetHead icon={<KeyRound />} title="Settings / Model and key" />
      <div className="flex flex-1 flex-col gap-3.5 p-3 md:p-5">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-sf-tertiary p-1 text-[12px] sm:grid-cols-4">
          {[
            ["/logos/openai.svg", "OpenAI"],
            ["/logos/anthropic.svg", "Anthropic"],
            ["/logos/openrouter.svg", "OpenRouter"],
            ["/logos/gemini.svg", "Gemini"],
          ].map(([logo, name]) => (
            <span
              key={name}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5",
                name === "Anthropic" ? "bg-sf-white text-tx shadow-[inset_0_0_6px_rgba(0,0,0,0.06),0_0_0_1px_#e6e6e6]" : "text-tx-tertiary",
              )}
            >
              <Logo src={logo} size={13} /> {name}
            </span>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-[1.3fr_1fr]">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-medium text-tx-secondary">API key</span>
            <span className="flex items-center gap-2 rounded-xl border border-st bg-sf-white px-3 py-2 font-mono text-[12px] text-tx">
              sk-ant-<span className="tracking-[0.15em] text-tx-muted">••••••••••••</span>3f9a
              <span className="ml-auto">
                <Tag tone="green">Saved</Tag>
              </span>
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-medium text-tx-secondary">Model</span>
            <span className="flex items-center justify-between rounded-xl border border-st bg-sf-white px-3 py-2 text-[12px] text-tx">
              Your pick from the list
              <ChevronDown className="size-3.5 text-tx-tertiary" />
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2 rounded-xl bg-sf-secondary px-3.5 py-3 text-[12px]">
          {[
            ["Questions", "Unlimited"],
            ["Billed by", "Your provider, directly"],
            ["wuup fee", "None"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between">
              <span className="text-tx-tertiary">{k}</span>
              <span className="font-medium text-tx">{v}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <span className="rounded-full px-3 py-1.5 text-[12px] text-red-400">Remove key</span>
          <span className="rounded-full bg-ink px-4 py-1.5 text-[12px] font-medium text-white shadow-btn-ink">Save</span>
        </div>
      </div>
    </div>
  );
}
