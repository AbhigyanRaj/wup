import type { ReactNode } from "react";
import { ArrowUp, ChevronDown, ChevronRight, Code2, FileText, Globe, Plus, CornerDownRight } from "lucide-react";
import { cn } from "@/lib/cn";

/*
 * Coded, static mocks of the wuup answer UI used across the home page
 * (showcase tabs, statement split, how-it-works). Server components only.
 * They imitate the real product: a question bubble, a streamed answer with
 * [n] citation pills, a chart and table built from rows, "queries used" and
 * follow-up chips. All numbers are sample data.
 */

/* ------------------------------------------------------------------ */
/* Atoms                                                               */
/* ------------------------------------------------------------------ */

export function Cite({ n }: { n: number }) {
  return (
    <span className="mx-0.5 inline-flex h-[18px] min-w-[18px] translate-y-[-1px] items-center justify-center rounded-[5px] border border-indigo-200 bg-indigo-50 px-1 align-middle font-mono text-[10.5px] font-medium leading-none text-indigo-800">
      {n}
    </span>
  );
}

export function WuupAvatar({ size = 24 }: { size?: number }) {
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-[8px] bg-ink text-white shadow-btn-ink"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" width={size * 0.58} height={size * 0.58} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6l3.6 12L12 8.5 17.4 18 21 6" />
      </svg>
    </span>
  );
}

export function UserBubble({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex justify-end", className)}>
      <p className="max-w-[78%] rounded-2xl rounded-br-md bg-[#DBEAFE] px-4 py-2.5 text-[14px] leading-[1.5] text-[#1e2a4a]">
        {children}
      </p>
    </div>
  );
}

export function AssistantHead({ meta }: { meta: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <WuupAvatar size={22} />
      <span className="text-[13px] font-medium text-tx">wuup</span>
      <span className="text-[12px] text-tx-muted">{meta}</span>
    </div>
  );
}

export function SourceChip({ logo, children }: { logo: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-st bg-sf-white px-2.5 py-1 text-[12px] leading-none text-tx-secondary">
      {/* eslint-disable-next-line @next/next/no-img-element -- 12px static icon */}
      <img src={logo} alt="" width={12} height={12} className="size-3 opacity-80" />
      {children}
    </span>
  );
}

export function FollowUps({ items, className }: { items: string[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {items.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded-full border border-st bg-sf-white px-3 py-1.5 text-[12px] leading-none text-tx-secondary"
        >
          <CornerDownRight className="size-3 text-indigo-500" strokeWidth={1.75} aria-hidden="true" />
          {t}
        </span>
      ))}
    </div>
  );
}

export function QueriesRow({ count, detail, open = false }: { count: number; detail: string; open?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-st-secondary bg-sf px-3 py-2 text-[12px] text-tx-tertiary">
      <Code2 className="size-3.5 text-tx-secondary" strokeWidth={1.75} aria-hidden="true" />
      <span className="font-medium text-tx-secondary">{count} {count === 1 ? "query" : "queries"} used</span>
      <span className="hidden truncate font-mono text-[11px] text-tx-muted sm:inline">{detail}</span>
      {open ? (
        <ChevronDown className="ml-auto size-3.5" aria-hidden="true" />
      ) : (
        <ChevronRight className="ml-auto size-3.5" aria-hidden="true" />
      )}
    </div>
  );
}

export function MockCard({ title, meta, children, className }: { title: string; meta?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-st-secondary bg-sf-white p-3.5 shadow-[0_1px_2px_rgba(17,17,91,0.04)]", className)}>
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <p className="text-[12.5px] font-medium text-tx">{title}</p>
        {meta ? <p className="text-[11px] text-tx-muted">{meta}</p> : null}
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Charts (static SVG, chart-1 family)                                 */
/* ------------------------------------------------------------------ */

export function BarChart({
  data,
  highlight,
  format = (v) => String(v),
  height = 132,
}: {
  data: Array<{ label: string; value: number }>;
  highlight?: number;
  format?: (v: number) => string;
  height?: number;
}) {
  const W = 320;
  const H = height;
  const padL = 30;
  const padB = 18;
  const max = Math.max(...data.map((d) => d.value)) * 1.12;
  const ticks = [0, 0.5, 1].map((t) => t * max);
  const bw = (W - padL) / data.length;
  const y = (v: number) => (H - padB) - (v / max) * (H - padB - 6);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Bar chart">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="#f0f0f0" strokeWidth="1" />
          <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize="8.5" fill="#999">
            {format(t)}
          </text>
        </g>
      ))}
      {data.map((d, i) => {
        const x = padL + i * bw + bw * 0.2;
        const w = bw * 0.6;
        const hi = i === highlight;
        return (
          <g key={d.label}>
            <rect
              x={x}
              y={y(d.value)}
              width={w}
              height={H - padB - y(d.value)}
              rx="3"
              fill={hi ? "var(--chart-1)" : "#bfdbfe"}
            />
            {hi ? (
              <text x={x + w / 2} y={y(d.value) - 4} textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#1d4ed8">
                {format(d.value)}
              </text>
            ) : null}
            <text x={x + w / 2} y={H - 5} textAnchor="middle" fontSize="8.5" fill="#999">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function HBarChart({ data, format = (v) => `${v}%` }: { data: Array<{ label: string; value: number }>; format?: (v: number) => string }) {
  const max = Math.max(...data.map((d) => d.value));
  const min = Math.min(...data.map((d) => d.value));
  return (
    <div className="flex flex-col gap-2" role="img" aria-label="Horizontal bar chart">
      {data.map((d) => (
        <div key={d.label} className="grid grid-cols-[84px_1fr_36px] items-center gap-2 text-[11px]">
          <span className="truncate text-tx-tertiary">{d.label}</span>
          <span className="h-3.5 overflow-hidden rounded-[4px] bg-sf-tertiary">
            <span
              className="block h-full rounded-[4px]"
              style={{ width: `${(d.value / max) * 100}%`, background: d.value === min ? "var(--chart-1)" : "#bfdbfe" }}
            />
          </span>
          <span className={cn("text-right tabular-nums", d.value === min ? "font-semibold text-blue-700" : "text-tx-secondary")}>
            {format(d.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function LineChart({
  series,
  labels,
  height = 150,
}: {
  series: Array<{ name: string; color: string; values: number[] }>;
  labels: string[];
  height?: number;
}) {
  const W = 340;
  const H = height;
  const padL = 26;
  const padB = 18;
  const all = series.flatMap((s) => s.values);
  const max = Math.max(...all) * 1.1;
  const n = labels.length;
  const x = (i: number) => padL + (i / (n - 1)) * (W - padL - 6);
  const y = (v: number) => H - padB - (v / max) * (H - padB - 8);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Line chart">
      <defs>
        <linearGradient id="lc-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#2563eb" stopOpacity="0.18" />
          <stop offset="1" stopColor="#2563eb" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((t) => (
        <g key={t}>
          <line x1={padL} x2={W} y1={y(t * max)} y2={y(t * max)} stroke="#f0f0f0" />
          <text x={padL - 6} y={y(t * max) + 3} textAnchor="end" fontSize="8.5" fill="#999">
            {Math.round(t * max)}
          </text>
        </g>
      ))}
      {series.map((s, si) => {
        const d = s.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
        return (
          <g key={s.name}>
            {si === 0 ? <path d={`${d} L${x(n - 1)} ${H - padB} L${x(0)} ${H - padB} Z`} fill="url(#lc-fill)" /> : null}
            <path d={d} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={x(n - 1)} cy={y(s.values[n - 1]!)} r="3" fill="#fff" stroke={s.color} strokeWidth="2" />
          </g>
        );
      })}
      {labels.map((l, i) =>
        i % 2 === 0 || i === n - 1 ? (
          <text key={l} x={x(i)} y={H - 5} textAnchor="middle" fontSize="8.5" fill="#999">
            {l}
          </text>
        ) : null,
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Table                                                               */
/* ------------------------------------------------------------------ */

export function MiniTable({
  columns,
  rows,
  highlightRow,
  numeric = [],
}: {
  columns: string[];
  rows: Array<Array<string | number>>;
  highlightRow?: number;
  numeric?: number[];
}) {
  return (
    <table className="w-full border-collapse text-[11.5px]">
      <thead>
        <tr>
          {columns.map((c, i) => (
            <th
              key={c}
              scope="col"
              className={cn(
                "border-b border-st-secondary pb-1.5 text-[10px] font-medium uppercase tracking-[0.06em] text-tx-muted",
                numeric.includes(i) ? "text-right" : "text-left",
              )}
            >
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri} className={cn(ri === highlightRow && "bg-blue-50/70")}>
            {r.map((cell, ci) => (
              <td
                key={ci}
                className={cn(
                  "border-b border-st-secondary py-1.5 text-tx-secondary last:pr-0",
                  numeric.includes(ci) && "text-right tabular-nums",
                  ci === 0 && "pl-1 text-tx",
                )}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ------------------------------------------------------------------ */
/* Window chrome                                                       */
/* ------------------------------------------------------------------ */

const CHATS = ["Revenue by month, 2026", "Repeat buyers by city", "Q3 pipeline win rates", "Vendor refund terms"];

export function MockWindow({
  title,
  source,
  children,
  activeChat = 0,
  composer = "Ask a follow-up...",
  sidebar = true,
  className,
}: {
  title: string;
  source: ReactNode;
  children: ReactNode;
  activeChat?: number;
  composer?: string;
  sidebar?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full overflow-hidden rounded-2xl border border-st bg-sf-white text-left shadow-[0_30px_80px_-30px_rgba(17,17,91,0.28),0_2px_6px_rgba(17,17,91,0.04)]",
        className,
      )}
    >
      {sidebar ? (
        <aside className="hidden w-[208px] shrink-0 flex-col gap-4 border-r border-st-secondary bg-sf px-3 py-3.5 lg:flex" aria-hidden="true">
          <div className="flex items-center justify-between px-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- static brand svg */}
            <img src="/brand/wuup-wordmark.svg" alt="" width={46} height={14} className="h-3.5 w-auto" />
            <span className="grid size-6 place-items-center rounded-md border border-st bg-sf-white text-tx-tertiary">
              <Plus className="size-3.5" aria-hidden="true" />
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-tx-muted">Recent</p>
            {CHATS.map((c, i) => (
              <span
                key={c}
                className={cn(
                  "truncate rounded-lg px-2 py-1.5 text-[12px]",
                  i === activeChat ? "bg-sf-secondary text-tx" : "text-tx-tertiary",
                )}
              >
                {c}
              </span>
            ))}
          </div>
          <div className="mt-auto flex flex-col gap-1.5">
            <p className="px-2 pb-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-tx-muted">Sources</p>
            {[
              ["/logos/mongodb.svg", "shop-prod", "6 collections"],
              ["/logos/google-sheets.svg", "Q3 pipeline", "4 tabs"],
              ["/logos/pdf.svg", "Contracts", "3 files"],
            ].map(([logo, name, meta]) => (
              <span key={name} className="flex items-center gap-2 rounded-lg px-2 py-1 text-[12px] text-tx-secondary">
                {/* eslint-disable-next-line @next/next/no-img-element -- static icon */}
                <img src={logo} alt="" width={13} height={13} className="size-[13px]" />
                <span className="truncate">{name}</span>
                <span className="ml-auto text-[10.5px] text-tx-muted">{meta}</span>
              </span>
            ))}
          </div>
        </aside>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-st-secondary px-4" aria-hidden="true">
          <p className="truncate text-[13px] font-medium text-tx">{title}</p>
          <div className="flex shrink-0 items-center gap-1.5">{source}</div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3.5 px-4 py-4 md:px-6 md:py-5">{children}</div>
        <div className="shrink-0 px-4 pb-4 md:px-6" aria-hidden="true">
          <div className="flex items-center gap-2 rounded-[14px] border border-st bg-sf-white py-1.5 pl-3.5 pr-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <span className="flex-1 truncate text-[13px] text-tx-muted">{composer}</span>
            <span className="hidden items-center gap-1 rounded-md border border-st px-1.5 py-0.5 text-[10.5px] text-tx-tertiary sm:inline-flex">
              <Globe className="size-3" aria-hidden="true" /> Web off
            </span>
            <span className="grid size-7 place-items-center rounded-full bg-ink text-white">
              <ArrowUp className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sample data                                                         */
/* ------------------------------------------------------------------ */

const REVENUE = [
  { label: "Jan", value: 21.4 },
  { label: "Feb", value: 24.9 },
  { label: "Mar", value: 32.6 },
  { label: "Apr", value: 36.1 },
  { label: "May", value: 41.8 },
  { label: "Jun", value: 39.2 },
];
const lakh = (v: number) => `₹${v.toFixed(0)}L`;

/* ------------------------------------------------------------------ */
/* Composite answers (one per showcase tab)                            */
/* ------------------------------------------------------------------ */

export function MongoAnswer({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <UserBubble>Show revenue by month for 2026. Which month grew fastest?</UserBubble>
      <div className="flex flex-col gap-3">
        <AssistantHead meta="from 2 queries on orders" />
        <p className="text-[13.5px] leading-[1.6] text-tx-secondary">
          Revenue rose from <b className="font-medium text-tx">₹21.4L</b> in January to a peak of{" "}
          <b className="font-medium text-tx">₹41.8L</b> in May <Cite n={1} />. <b className="font-medium text-tx">March grew fastest</b>,
          up 31% on February, mostly from repeat buyers <Cite n={2} />.
        </p>
        <div className={cn("grid gap-2.5", compact ? "grid-cols-1" : "md:grid-cols-[1.35fr_1fr]")}>
          <MockCard title="Revenue by month" meta="orders · 2026">
            <BarChart data={REVENUE} highlight={2} format={lakh} />
          </MockCard>
          {compact ? null : (
            <MockCard title="Rows returned" meta="6 of 6">
              <MiniTable
                columns={["Month", "Revenue", "Orders"]}
                numeric={[1, 2]}
                highlightRow={2}
                rows={[
                  ["Jan", "₹21.4L", "1,284"],
                  ["Feb", "₹24.9L", "1,402"],
                  ["Mar", "₹32.6L", "1,876"],
                  ["Apr", "₹36.1L", "2,011"],
                  ["May", "₹41.8L", "2,240"],
                  ["Jun", "₹39.2L", "2,105"],
                ]}
              />
            </MockCard>
          )}
        </div>
        <QueriesRow count={2} detail="orders.aggregate([$match, $group, $sort])" />
        {compact ? null : <FollowUps items={["Break May down by city", "Compare with 2025", "Top products in March"]} />}
      </div>
    </>
  );
}

export function SheetsAnswer() {
  return (
    <>
      <UserBubble>Which deal stage has the lowest win rate this quarter?</UserBubble>
      <div className="flex flex-col gap-3">
        <AssistantHead meta="from the Q3 pipeline tab" />
        <p className="text-[13.5px] leading-[1.6] text-tx-secondary">
          <b className="font-medium text-tx">Security review</b> converts worst: 9 of 41 deals moved on, a{" "}
          <b className="font-medium text-tx">22% win rate</b> <Cite n={1} />. Every other stage is above 40%, and demos convert best at 68%{" "}
          <Cite n={2} />.
        </p>
        <div className="grid gap-2.5 md:grid-cols-[1.35fr_1fr]">
          <MockCard title="Win rate by stage" meta="Q3 pipeline · 312 rows">
            <HBarChart
              data={[
                { label: "Discovery", value: 46 },
                { label: "Demo", value: 68 },
                { label: "Security review", value: 22 },
                { label: "Proposal", value: 54 },
                { label: "Negotiation", value: 61 },
              ]}
            />
          </MockCard>
          <MockCard title="Rows returned" meta="5 stages">
            <MiniTable
              columns={["Stage", "Deals", "Won"]}
              numeric={[1, 2]}
              highlightRow={2}
              rows={[
                ["Discovery", 118, 54],
                ["Demo", 74, 50],
                ["Security", 41, 9],
                ["Proposal", 48, 26],
                ["Negotiation", 31, 19],
              ]}
            />
          </MockCard>
        </div>
        <QueriesRow count={1} detail="sheet: Q3 pipeline!A1:H313, group by Stage" />
        <FollowUps items={["Which reps own those deals?", "Show it by month", "Average deal size per stage"]} />
      </div>
    </>
  );
}

export function DocsAnswer() {
  return (
    <>
      <UserBubble>What is the refund window in our vendor agreement, and who approves exceptions?</UserBubble>
      <div className="flex flex-col gap-3">
        <AssistantHead meta="from 2 documents" />
        <p className="text-[13.5px] leading-[1.6] text-tx-secondary">
          Refunds are allowed within <b className="font-medium text-tx">30 days of delivery</b> <Cite n={1} />. Exceptions past 30 days need
          written approval from the <b className="font-medium text-tx">vendor&apos;s account manager</b> <Cite n={2} />, and the amendment
          extends this to 45 days for annual plans <Cite n={3} />.
        </p>
        <div className="grid gap-2.5 md:grid-cols-3">
          {[
            ["vendor-agreement-2026.pdf", "p. 4, §7.2", "“The Customer may request a full refund within thirty (30) days of delivery...”"],
            ["vendor-agreement-2026.pdf", "p. 5, §7.4", "“Requests made after this period require written approval from the Account Manager.”"],
            ["amendment-02.pdf", "p. 1, §2", "“For annual subscriptions, the refund period in §7.2 is extended to forty-five (45) days.”"],
          ].map(([file, where, quote], i) => (
            <div key={i} className="flex flex-col gap-2 rounded-xl border border-st-secondary bg-sf-white p-3">
              <div className="flex items-center gap-1.5">
                <Cite n={i + 1} />
                <FileText className="size-3.5 text-tx-tertiary" strokeWidth={1.75} aria-hidden="true" />
                <span className="truncate text-[11.5px] font-medium text-tx">{file}</span>
              </div>
              <p className="text-[11px] text-tx-muted">{where}</p>
              <p className="border-l-2 border-indigo-200 pl-2 text-[11.5px] leading-[1.5] text-tx-secondary">{quote}</p>
            </div>
          ))}
        </div>
        <FollowUps items={["Summarise the termination terms", "List every deadline in the contract", "Compare with last year's terms"]} />
      </div>
    </>
  );
}

export function ChartsAnswer() {
  return (
    <>
      <UserBubble>Plot weekly signups against activations since July.</UserBubble>
      <div className="flex flex-col gap-3">
        <AssistantHead meta="from 1 query on users" />
        <p className="text-[13.5px] leading-[1.6] text-tx-secondary">
          Signups grew <b className="font-medium text-tx">2.1x</b> over 14 weeks <Cite n={1} />, but activation lagged after week 9, when the
          new onboarding shipped. The gap is now <b className="font-medium text-tx">38%</b> of signups.
        </p>
        <MockCard title="Signups vs activations, weekly" meta="users · since 1 Jul">
          <div className="mb-2 flex gap-4 text-[11px] text-tx-tertiary">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded bg-[var(--chart-1)]" /> Signups
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded bg-[var(--chart-5)]" /> Activations
            </span>
          </div>
          <LineChart
            labels={["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8", "W9", "W10", "W11", "W12", "W13", "W14"]}
            series={[
              { name: "Signups", color: "var(--chart-1)", values: [210, 232, 240, 268, 281, 300, 322, 341, 356, 372, 398, 410, 431, 448] },
              { name: "Activations", color: "var(--chart-5)", values: [148, 160, 171, 189, 196, 214, 228, 240, 251, 249, 258, 262, 270, 278] },
            ]}
          />
        </MockCard>
        <div className="grid grid-cols-3 gap-2">
          {[
            ["Signups, W14", "448"],
            ["Activated", "278"],
            ["Activation rate", "62%"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-st-secondary bg-sf px-3 py-2">
              <p className="text-[10.5px] text-tx-muted">{k}</p>
              <p className="text-[16px] font-medium tabular-nums tracking-[-0.01em] text-tx">{v}</p>
            </div>
          ))}
        </div>
        <QueriesRow count={1} detail="users.aggregate([$match, $group by $week])" />
      </div>
    </>
  );
}

export function QueriesAnswer() {
  return (
    <>
      <UserBubble>Top 5 customers by order value this year.</UserBubble>
      <div className="flex flex-col gap-3">
        <AssistantHead meta="from 1 query on orders" />
        <p className="text-[13.5px] leading-[1.6] text-tx-secondary">
          <b className="font-medium text-tx">Meera Textiles</b> leads with ₹6.4L across 38 orders <Cite n={1} />. The top five make up 19% of
          revenue this year.
        </p>
        <div className="overflow-hidden rounded-xl border border-st">
          <div className="flex items-center gap-2 border-b border-st bg-sf-tertiary px-3 py-2 text-[11.5px]">
            <Code2 className="size-3.5 text-tx-secondary" strokeWidth={1.75} aria-hidden="true" />
            <span className="font-medium text-tx">Queries used</span>
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">read-only</span>
            <span className="ml-auto text-tx-muted">5 rows · 41 ms</span>
            <ChevronDown className="size-3.5 text-tx-tertiary" aria-hidden="true" />
          </div>
          <pre className="overflow-x-auto bg-[#fafafa] px-4 py-3 font-mono text-[11.5px] leading-[1.7] text-tx">
            <span className="tok-fn">db</span>.<span className="tok-fn">orders</span>.<span className="tok-fn">aggregate</span>([{"\n"}
            {"  "}{"{ "}<span className="tok-kw">$match</span>: {"{ "}status: <span className="tok-str">&quot;paid&quot;</span>, createdAt: {"{ "}
            <span className="tok-kw">$gte</span>: <span className="tok-fn">ISODate</span>(<span className="tok-str">&quot;2026-01-01&quot;</span>) {"} } },"}
            {"\n"}
            {"  "}{"{ "}<span className="tok-kw">$group</span>: {"{ "}_id: <span className="tok-str">&quot;$customerId&quot;</span>, total: {"{ "}
            <span className="tok-kw">$sum</span>: <span className="tok-str">&quot;$amount&quot;</span> {"} } },"}
            {"\n"}
            {"  "}{"{ "}<span className="tok-kw">$sort</span>: {"{ "}total: <span className="tok-const">-1</span> {"} },"}
            {"\n"}
            {"  "}{"{ "}<span className="tok-kw">$limit</span>: <span className="tok-const">5</span> {"}"}
            {"\n"}])
          </pre>
        </div>
        <MockCard title="Rows returned" meta="5 rows">
          <MiniTable
            columns={["Customer", "Orders", "Total"]}
            numeric={[1, 2]}
            highlightRow={0}
            rows={[
              ["Meera Textiles", 38, "₹6.4L"],
              ["Kaveri Foods", 29, "₹5.1L"],
              ["Northline Labs", 22, "₹4.7L"],
            ]}
          />
        </MockCard>
      </div>
    </>
  );
}
