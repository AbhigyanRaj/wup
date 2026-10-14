import Link from "next/link";
import type { ReactNode } from "react";
import { BookOpen, Braces, FileJson, GraduationCap, ScanSearch, ShieldCheck, Workflow } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { MiniCard } from "@/components/ui/card";
import { CodeBlock } from "@/components/ui/code-block";
import { SectionHead } from "@/components/ui/section";

/*
 * Kit "code card + mini-card grid" (home.md §5), used for the free MongoDB
 * tools: a code card (Question / Pipeline / mongosh), a 2x2 grid of tool
 * mini cards, and three small cards for docs, guides and the security model.
 */

const QUESTION = `Total revenue and order count per month in 2026,
from paid orders only, newest month first.

Collection: orders
Fields: status, amount, createdAt`;

const PIPELINE = `[
  { "$match": {
      "status": "paid",
      "createdAt": { "$gte": { "$date": "2026-01-01T00:00:00Z" } }
  } },
  { "$group": {
      "_id": {
        "$dateToString": { "format": "%Y-%m", "date": "$createdAt" }
      },
      "revenue": { "$sum": "$amount" },
      "orders": { "$sum": 1 }
  } },
  { "$sort": { "_id": -1 } }
]`;

const MONGOSH = `db.orders.aggregate([
  { $match: {
      status: "paid",
      createdAt: { $gte: ISODate("2026-01-01") }
  } },
  { $group: {
      _id: {
        $dateToString: { format: "%Y-%m", date: "$createdAt" }
      },
      revenue: { $sum: "$amount" },
      orders: { $sum: 1 }
  } },
  { $sort: { _id: -1 } }
])`;

const TOKEN = /("(?:[^"\\]|\\.)*")|(\$[A-Za-z]+)|(-?\b\d+\b)|(\b(?:db|aggregate|ISODate)\b)/g;

/** Tiny highlighter for the static snippets above (kit .tok-* classes). */
function highlight(src: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of src.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    if (i > last) out.push(src.slice(last, i));
    const [text, str, op, num, fn] = m;
    const cls = str ? (str.startsWith('"$') ? "tok-kw" : "tok-str") : op ? "tok-kw" : num ? "tok-const" : fn ? "tok-fn" : "";
    out.push(
      <span key={k++} className={cls}>
        {text}
      </span>,
    );
    last = i + text.length;
  }
  if (last < src.length) out.push(src.slice(last));
  return out;
}

const TOOLS = [
  {
    href: "/tools/mongodb-query-generator",
    title: "Query generator",
    description: "Plain English in, a runnable find or aggregate out",
    icon: <Braces strokeWidth={1.5} />,
  },
  {
    href: "/tools/mongodb-aggregation-generator",
    title: "Aggregation generator",
    description: "Build multi-stage pipelines from a description",
    icon: <Workflow strokeWidth={1.5} />,
  },
  {
    href: "/tools/mongodb-aggregation-explainer",
    title: "Aggregation explainer",
    description: "Paste a pipeline, read it stage by stage",
    icon: <ScanSearch strokeWidth={1.5} />,
  },
  {
    href: "/tools/mongodb-schema-from-json",
    title: "Schema from JSON",
    description: "Infer field types from sample documents",
    icon: <FileJson strokeWidth={1.5} />,
  },
];

const SMALL = [
  { href: "/docs", title: "Docs", description: "Connect a source in minutes", icon: BookOpen },
  { href: "/guides", title: "Guides", description: "Pipelines, schemas and safety", icon: GraduationCap },
  { href: "/security", title: "Security model", description: "What wuup can and cannot read", icon: ShieldCheck },
];

export function ToolsShowcase() {
  return (
    <section className="container section" aria-label="Free MongoDB tools">
      <SectionHead
        title={"Free MongoDB tools.\nNo signup."}
        intro="The same query engine behind wuup, in your browser. Describe the data, get a pipeline you can paste into mongosh."
        className="[&_h2]:text-balance"
      />
      <div className="grid-2">
        <div className="card flex min-w-0 flex-col gap-8 md:gap-10">
          <h3 className="text-[24px] font-medium leading-[1.4] tracking-[-0.03em] text-tx md:text-[28px]">
            Turn a question into a <span className="text-indigo-600">pipeline</span>
            <br className="hidden md:block" /> you can actually run
          </h3>
          <div className="relative">
            <CodeBlock
              defaultTab={2}
              preClassName="h-[300px] !text-[12.5px] [mask-image:linear-gradient(to_bottom,#000_82%,transparent)]"
              tabs={[
                { label: "Question", code: QUESTION, content: <span className="text-tx-secondary">{QUESTION}</span> },
                { label: "Pipeline", code: PIPELINE, content: highlight(PIPELINE) },
                { label: "mongosh", code: MONGOSH, content: highlight(MONGOSH) },
              ]}
            />
          </div>
          <ButtonLink href="/tools/mongodb-query-generator" variant="ink" block className="mt-auto">
            Open the query generator
          </ButtonLink>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <div className="grid-2">
            {TOOLS.map((t, i) => (
              <MiniCard key={t.href} href={t.href} title={t.title} description={t.description} icon={t.icon} active={i === 0} />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {SMALL.map(({ href, title, description, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="group flex flex-col gap-2 rounded-xl border border-st-secondary bg-sf-white p-5 transition-colors duration-150 hover:border-indigo-200 md:p-6"
              >
                <Icon className="size-5 text-tx-muted transition-colors duration-200 group-hover:text-indigo-500" strokeWidth={1.5} aria-hidden="true" />
                <p className="mt-3 text-[18px] font-medium leading-[1.3] tracking-[-0.01em] text-tx md:text-[20px]">{title}</p>
                <p className="text-[14px] leading-[1.55] text-tx-tertiary">{description}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
