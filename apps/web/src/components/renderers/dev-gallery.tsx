"use client";

import type { ReactNode } from "react";
import type { ChartData, DiagramData, TableData } from "@wup/contracts";
import { Toaster } from "@/components/ui/toast";
import { VisualBlock, type VisualMessage } from "./visual-block";
import { MermaidBlock } from "./mermaid-block";
import { HighlightedCode } from "./highlighted-code";

/* Dev-only gallery of every renderer edge case (route: /renderers). */

const chart = (c: Omit<Partial<ChartData>, "type"> & { type?: string }): VisualMessage => ({
  visualType: "chart",
  chartData: c as unknown as ChartData,
  tableData: null,
  diagramData: null,
});

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const CHARTS: Array<{ name: string; message: VisualMessage }> = [
  {
    name: "Bar with string numbers (\"1,234\", \"$2.4k\", one unparseable)",
    message: chart({
      type: "bar",
      title: "Revenue by region",
      xAxisKey: "region",
      yAxisKey: "revenue",
      series: [
        { region: "North", revenue: "$1,234" },
        { region: "South", revenue: "$2,410" },
        { region: "East", revenue: "$3.4k" },
        { region: "West", revenue: "$1,980.50" },
        { region: "Central", revenue: "N/A" },
        { region: "Online", revenue: "$4,120" },
      ],
    }),
  },
  {
    name: "Line (area alias), 12 months",
    message: chart({
      type: "area",
      title: "Weekly active users",
      xAxisKey: "month",
      yAxisKey: "users",
      series: MONTHS.map((m, i) => ({ month: m, users: Math.round(1800 + i * 240 + Math.sin(i) * 420) })),
    }),
  },
  {
    name: "Pie with 8 slices (folds into Other)",
    message: chart({
      type: "donut",
      title: "Orders by channel",
      xAxisKey: "channel",
      yAxisKey: "orders",
      series: [
        { channel: "Web", orders: 4210 },
        { channel: "iOS app", orders: 2980 },
        { channel: "Android app", orders: 2410 },
        { channel: "Marketplace", orders: 1220 },
        { channel: "Retail", orders: 860 },
        { channel: "Phone", orders: 240 },
        { channel: "Email", orders: 120 },
        { channel: "Partner", orders: 90 },
      ],
    }),
  },
  {
    name: "Pie, 3 slices (direct labels)",
    message: chart({
      type: "pie",
      title: "Plan mix",
      xAxisKey: "plan",
      yAxisKey: "share",
      series: [
        { plan: "Free", share: "62%" },
        { plan: "Pro", share: "28%" },
        { plan: "Team", share: "10%" },
      ],
    }),
  },
  {
    name: "Single-slice pie",
    message: chart({
      type: "pie",
      title: "Payment status",
      xAxisKey: "status",
      yAxisKey: "count",
      series: [{ status: "Paid", count: 128 }],
    }),
  },
  {
    name: "All-zero pie",
    message: chart({
      type: "pie",
      title: "Refunds by reason",
      xAxisKey: "reason",
      yAxisKey: "count",
      series: [
        { reason: "Damaged", count: 0 },
        { reason: "Late", count: 0 },
      ],
    }),
  },
  {
    name: "Unknown type (scatter3d) falls back to a table",
    message: chart({
      type: "scatter3d",
      title: "Latency by endpoint",
      xAxisKey: "endpoint",
      yAxisKey: "p95",
      series: [
        { endpoint: "/search", p95: 182 },
        { endpoint: "/orders", p95: 96 },
        { endpoint: "/users", p95: 64 },
      ],
    }),
  },
  {
    name: "40 categories (switches to horizontal)",
    message: chart({
      type: "bar",
      title: "Sessions by city",
      xAxisKey: "city",
      yAxisKey: "sessions",
      series: Array.from({ length: 40 }, (_, i) => ({
        city: `City ${String(i + 1).padStart(2, "0")}`,
        sessions: Math.round(9000 / (i + 1) + 300),
      })),
    }),
  },
  {
    name: "Long labels (horizontal with tip values)",
    message: chart({
      type: "bar",
      title: "Most viewed product categories",
      xAxisKey: "category",
      yAxisKey: "views",
      series: [
        { category: "Home and kitchen appliances", views: 18420 },
        { category: "Smartphones and accessories", views: 15210 },
        { category: "Books, stationery and office supplies", views: 9120 },
        { category: "Sports and outdoor equipment", views: 7340 },
        { category: "Beauty and personal care", views: 5110 },
      ],
    }),
  },
  {
    name: "Negatives (accounting format)",
    message: chart({
      type: "column",
      title: "Net cash flow by quarter",
      xAxisKey: "quarter",
      yAxisKey: "net",
      series: [
        { quarter: "Q1 2025", net: "12,400" },
        { quarter: "Q2 2025", net: "(3,200)" },
        { quarter: "Q3 2025", net: "8,900" },
        { quarter: "Q4 2025", net: "-5,100" },
        { quarter: "Q1 2026", net: "15,800" },
      ],
    }),
  },
  {
    name: "Missing keys and garbage (guards)",
    message: chart({ type: "line", series: undefined as unknown as ChartData["series"] }),
  },
];

const diagram = (d: unknown): VisualMessage => ({
  visualType: "diagram",
  chartData: null,
  tableData: null,
  diagramData: d as DiagramData,
});

const DIAGRAMS: Array<{ name: string; message: VisualMessage }> = [
  {
    name: "Checkout flow with a decision and a retry cycle",
    message: diagram({
      nodes: [
        { id: "start", label: "Customer opens checkout", type: "start" },
        { id: "cart", label: "Validate cart and stock", sublabel: "orders collection", type: "action" },
        { id: "pay", label: "Charge card", type: "action" },
        { id: "ok", label: "Payment approved?", type: "decision" },
        { id: "retry", label: "Ask the customer to retry with another card", type: "action" },
        { id: "done", label: "Order confirmed", type: "success" },
        { id: "fail", label: "Order cancelled", type: "error" },
      ],
      edges: [
        { from: "start", to: "cart" },
        { from: "cart", to: "pay" },
        { from: "pay", to: "ok" },
        { from: "ok", to: "done", label: "yes" },
        { from: "ok", to: "retry", label: "no" },
        { from: "retry", to: "pay", label: "new card" },
        { from: "retry", to: "fail", label: "gives up" },
      ],
    }),
  },
  {
    name: "Long text, duplicate ids, dangling and undefined edges",
    message: diagram({
      nodes: [
        { id: "a", label: "Scan the MongoDB schema and sample a few hundred documents from every scoped collection", type: "start" },
        { id: "b", label: "Redact sensitive fields such as password, token and card number before anything reaches the model", sublabel: "Runs on every query result" },
        { id: "b", label: "Duplicate id (dropped)" },
        { id: "c", label: "Answer with numbered citations", type: "end" },
      ],
      edges: [{ from: "a", to: "b" }, { from: "b", to: "c" }, { from: "b", to: "ghost" }, undefined, { from: null }],
    }),
  },
  {
    name: "Edges missing entirely (wide, shallow: LR)",
    message: diagram({
      nodes: [
        { id: "src", label: "Sources", type: "start" },
        { id: "m", label: "MongoDB" },
        { id: "s", label: "Google Sheets" },
        { id: "p", label: "PDF" },
        { id: "t", label: "TXT" },
        { id: "md", label: "Markdown" },
      ],
      edges: [
        { from: "src", to: "m" },
        { from: "src", to: "s" },
        { from: "src", to: "p" },
        { from: "src", to: "t" },
        { from: "src", to: "md" },
      ],
    }),
  },
  { name: "No edges key at all", message: diagram({ nodes: [{ id: "x", label: "Lonely step" }] }) },
];

const ORDERS = Array.from({ length: 24 }, (_, i) => ({
  order_id: `ORD-${1040 + i}`,
  customer: ["Asha", "Ravi", "Meera", "Kabir", "Ishaan", "Zoya"][i % 6],
  amount: ["1,240.00", "980.50", "12,400", "75", "3,210.25", "9"][i % 6],
  status: i % 5 === 0 ? null : ["paid", "refunded", "pending"][i % 3],
  created_at: `2026-0${(i % 9) + 1}-1${i % 9}`,
  meta: i % 4 === 0 ? { source: "web", coupon: i % 8 === 0 ? "DIWALI" : null } : null,
}));

const TABLES: Array<{ name: string; message: VisualMessage }> = [
  {
    name: "Undefined columns, numeric strings, nulls, objects, 24 rows (filter)",
    message: {
      visualType: "table",
      chartData: null,
      diagramData: null,
      tableData: { columns: undefined, rows: ORDERS } as unknown as TableData,
    },
  },
  {
    name: "Numeric-string sort (\"9\" < \"75\" < \"1,240\")",
    message: {
      visualType: "table",
      chartData: null,
      diagramData: null,
      tableData: {
        columns: ["sku", "units", "price"],
        rows: [
          { sku: "A-10", units: "9", price: "$12.00" },
          { sku: "A-2", units: "75", price: "$1,200.00" },
          { sku: "A-1", units: "1,240", price: "$5.50" },
          { sku: "B-7", units: "", price: "$80.00" },
        ],
      },
    },
  },
  {
    name: "visualType none with rows (accordion)",
    message: {
      visualType: "none",
      chartData: null,
      diagramData: null,
      tableData: { columns: ["collection", "documents"], rows: [{ collection: "orders", documents: 18240 }, { collection: "users", documents: 3120 }] },
    },
  },
];

const MERMAID_OK = `flowchart TD
  A([Question]) --> B[Plan the query]
  B --> C{Needs data?}
  C -->|yes| D[Run read-only query]
  C -->|no| E[Answer from documents]
  D --> F[Build chart from rows]
  E --> G([Cited answer])
  F --> G`;

const MERMAID_SEQ = `sequenceDiagram
  participant U as User
  participant W as wuup
  participant M as MongoDB
  U->>W: Ask a question
  W->>M: Read-only aggregate
  M-->>W: Rows (redacted)
  W-->>U: Answer with chart`;

const MERMAID_BAD = `flowchart TD
  A[Start --> B{{oops
  B -->|| C`;

const CODE: Array<{ lang: string; value: string }> = [
  {
    lang: "javascript",
    value: `db.orders.aggregate([
  { $match: { status: "paid", createdAt: { $gte: ISODate("2026-01-01") } } },
  { $group: { _id: "$region", revenue: { $sum: "$amount" } } },
  { $sort: { revenue: -1 } },
  { $limit: 10 },
]);`,
  },
  {
    lang: "python",
    value: `def monthly_revenue(rows):
    """Sum revenue per month."""
    totals = {}
    for row in rows:
        key = row["created_at"][:7]
        totals[key] = totals.get(key, 0) + float(row["amount"])
    return sorted(totals.items())  # oldest first`,
  },
  {
    lang: "sql",
    value: `SELECT region, SUM(amount) AS revenue
FROM orders
WHERE status = 'paid'
GROUP BY region
ORDER BY revenue DESC
LIMIT 10;`,
  },
  { lang: "json", value: `{\n  "type": "bar",\n  "xAxisKey": "region",\n  "yAxisKey": "revenue",\n  "series": [{ "region": "North", "revenue": 1234 }]\n}` },
  { lang: "bash", value: `curl -s https://wuup.in/api/health | jq '.status'\nexport NEXT_PUBLIC_API_URL=http://localhost:4000` },
  { lang: "unknownlang", value: "plain text stays plain" },
  {
    lang: "ts",
    value: Array.from({ length: 40 }, (_, i) => `export const step${i + 1}: number = ${i * 3}; // long block collapses`).join("\n"),
  },
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-6">
      <h2 className="font-display text-[28px] font-display-medium tracking-heading text-tx">{title}</h2>
      {children}
    </section>
  );
}

function Case({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2.5" data-case={name}>
      <p className="font-mono text-[12px] uppercase tracking-[0.04em] text-tx-muted">{name}</p>
      {children}
    </div>
  );
}

export function RenderersGallery() {
  return (
    <main className="mx-auto flex w-full max-w-[880px] flex-col gap-20 px-4 py-12 sm:px-6 sm:py-16">
      <header className="flex flex-col gap-2">
        <p className="text-[12px] font-medium uppercase tracking-[0.17em] text-tx-tertiary">Dev only</p>
        <h1 className="font-display text-[40px] font-display-medium leading-[1.1] tracking-heading text-tx">Answer renderers</h1>
        <p className="text-[16px] leading-[1.6] text-tx-tertiary">Every edge case for charts, diagrams, tables, Mermaid and code.</p>
      </header>
      <Section id="charts" title="Charts">
        {CHARTS.map((c) => (
          <Case key={c.name} name={c.name}>
            <VisualBlock message={c.message} />
          </Case>
        ))}
      </Section>
      <Section id="diagrams" title="Diagrams">
        {DIAGRAMS.map((c) => (
          <Case key={c.name} name={c.name}>
            <VisualBlock message={c.message} />
          </Case>
        ))}
      </Section>
      <Section id="tables" title="Tables">
        {TABLES.map((c) => (
          <Case key={c.name} name={c.name}>
            <VisualBlock message={c.message} />
          </Case>
        ))}
      </Section>
      <Section id="mermaid" title="Mermaid">
        <Case name="Valid flowchart">
          <MermaidBlock code={MERMAID_OK} />
        </Case>
        <Case name="Valid sequence diagram">
          <MermaidBlock code={MERMAID_SEQ} />
        </Case>
        <Case name="Same flowchart again (served from cache)">
          <MermaidBlock code={MERMAID_OK} />
        </Case>
        <Case name="Invalid">
          <MermaidBlock code={MERMAID_BAD} />
        </Case>
      </Section>
      <Section id="code" title="Code">
        {CODE.map((c) => (
          <Case key={c.lang} name={c.lang}>
            <HighlightedCode language={c.lang} value={c.value} />
          </Case>
        ))}
      </Section>
      <Toaster />
    </main>
  );
}
