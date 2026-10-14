import type { ReactNode } from "react";
import { Ban, Database, Eye, FileCheck2, Gauge, Scissors, ShieldCheck, UserCheck } from "lucide-react";
import { FACTS } from "@/lib/site";
import { cn } from "@/lib/cn";

/*
 * "How a query is checked": the real order of operations in
 * packages/brain/src/bridges/mongo/tools.ts (ownership, scope, guard, run with
 * limits, redact, cap size, record), drawn as a numbered pipeline with a
 * rejected example branching off the guard step.
 */

interface PathStep {
  icon: ReactNode;
  title: string;
  body: ReactNode;
  code?: string;
  key?: boolean;
}

const STEPS: PathStep[] = [
  {
    icon: <UserCheck />,
    title: "Ownership",
    body: "The connection must belong to your account. Nobody else's question can reach it.",
  },
  {
    icon: <Database />,
    title: "Scope",
    body: `The database and collection must be ones you enabled. ${FACTS.systemDatabases.join(", ")} and system.* are never queryable.`,
  },
  {
    icon: <ShieldCheck />,
    title: "Guard",
    body: `Only allowed read stages pass. Write and server-side JavaScript operators are rejected, and so is any reference to a hidden field. ${FACTS.crossCollectionStages.join(", ")} must stay in scope.`,
    key: true,
  },
  {
    icon: <Gauge />,
    title: "Run with limits",
    body: `find or aggregate runs with a ${FACTS.queryTimeoutS} second time limit, at most ${FACTS.maxRowsPerQuery} rows and no disk use.`,
    code: `maxTimeMS: ${FACTS.queryTimeoutS * 1000}, limit: ${FACTS.maxRowsPerQuery}, allowDiskUse: false`,
  },
  {
    icon: <Scissors />,
    title: "Redact",
    body: "Hidden fields are removed from every row, at any depth, before anything reaches the model.",
  },
  {
    icon: <Eye />,
    title: "Cap size",
    body: `The result is trimmed to ${FACTS.maxResultKb} KB, so a wide collection can't flood the model.`,
  },
  {
    icon: <FileCheck2 />,
    title: "Record",
    body: "The query is saved with the answer and shown under Queries used, ready to copy.",
  },
];

export function QueryPath() {
  return (
    <div className="grid w-full gap-4 lg:grid-cols-[1.25fr_1fr]">
      <ol className="m-0 flex list-none flex-col rounded-2xl border border-st bg-sf-white p-2 md:p-3">
        {STEPS.map((s, i) => (
          <li
            key={s.title}
            className={cn(
              "relative grid grid-cols-[40px_1fr] gap-4 rounded-xl px-3 py-4 md:px-4",
              s.key && "bg-indigo-50/70 shadow-[inset_0_0_0_1px_var(--indigo-200)]",
            )}
          >
            {i < STEPS.length - 1 ? (
              <span aria-hidden="true" className="absolute bottom-[-14px] left-[35px] top-[58px] w-px bg-st md:left-[39px]" />
            ) : null}
            <span
              aria-hidden="true"
              className={cn(
                "relative grid size-10 place-items-center rounded-full border [&_svg]:size-[18px] [&_svg]:stroke-[1.5]",
                s.key ? "border-indigo-300 bg-sf-white text-indigo-800" : "border-st bg-sf text-tx-secondary",
              )}
            >
              {s.icon}
            </span>
            <span className="flex flex-col gap-1">
              <span className="flex items-baseline gap-2">
                <span className="font-mono text-label text-tx-muted">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-body-lg font-medium leading-[1.35] text-tx">{s.title}</span>
              </span>
              <span className="text-caption leading-[1.6] text-tx-tertiary md:text-body">{s.body}</span>
              {s.code ? (
                <code className="mt-1 w-fit rounded-lg border border-st-secondary bg-sf px-2 py-1 font-mono text-[12px] text-tx-secondary">
                  {s.code}
                </code>
              ) : null}
            </span>
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-4">
        <figure className="m-0 overflow-hidden rounded-2xl border border-st bg-sf-white">
          <figcaption className="flex items-center gap-2 border-b border-st bg-sf-tertiary px-4 py-2.5 text-caption">
            <Ban className="size-4 text-red-400" strokeWidth={1.75} aria-hidden="true" />
            <span className="font-medium text-tx">Rejected at the guard</span>
            <span className="ml-auto rounded-full bg-red-50 px-2 py-0.5 text-label font-medium text-red-400">never runs</span>
          </figcaption>
          <pre className="m-0 overflow-x-auto bg-[#fafafa] px-4 py-4 font-mono text-[12.5px] leading-[1.75] text-tx">
            <span className="tok-fn">db</span>.<span className="tok-fn">orders</span>.<span className="tok-fn">aggregate</span>([{"\n"}
            {"  { "}<span className="tok-kw">$match</span>{": { status: "}<span className="tok-str">&quot;paid&quot;</span>{" } },"}{"\n"}
            {"  { "}<span className="tok-kw">$out</span>: <span className="tok-str">&quot;orders_backup&quot;</span>{" }"}{"\n"}])
          </pre>
          <p className="m-0 border-t border-red-100 bg-red-50 px-4 py-3 font-mono text-[12px] leading-[1.6] text-red-500">
            $out is not allowed. wuup bridges are read-only and support these stages: $match, $project, $addFields, $set, $unset, $group, $sort, $limit ...
          </p>
        </figure>

        <div className="rounded-2xl border border-st bg-sf-white p-5">
          <p className="text-caption font-medium text-tx">Blocked operators</p>
          <p className="mt-1 text-caption text-tx-tertiary">Rejected wherever they appear in a query.</p>
          <ul className="m-0 mt-4 flex list-none flex-wrap gap-1.5 p-0">
            {FACTS.blockedOperators.map((op) => (
              <li key={op} className="rounded-lg border border-red-100 bg-red-50/60 px-2 py-1 font-mono text-[12px] text-red-500">
                {op}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-st bg-sf-white p-5">
          <p className="text-caption font-medium text-tx">Hidden automatically</p>
          <p className="mt-1 text-caption text-tx-tertiary">
            Fields whose names match these patterns, at any depth, plus binary fields such as embeddings. You can hide more per collection.
          </p>
          <ul className="m-0 mt-4 flex list-none flex-wrap gap-1.5 p-0">
            {FACTS.redactedFieldPatterns.map((p) => (
              <li key={p} className="rounded-lg border border-st-secondary bg-sf px-2 py-1 font-mono text-[12px] text-tx-secondary">
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
