"use client";

import * as React from "react";
import { ChevronDown, Database, TriangleAlert } from "lucide-react";
import type { QueryRecord } from "@/lib/types";
import { cn } from "@/lib/cn";
import { HighlightedCode } from "../renderers";
import { CopyButton } from "../copy-button";

/*
 * "Queries used" transparency: every database or sheet query behind an answer,
 * with its rows, time and the exact query text.
 */

const TOOL_LABELS: Record<string, string> = {
  mongo_find: "find",
  mongo_count: "count",
  mongo_distinct: "distinct",
  mongo_aggregate: "aggregate",
  mongo_list_sources: "list",
  sheets_read: "read",
};

export function toolLabel(tool: string) {
  return TOOL_LABELS[tool] ?? tool.replace(/^(mongo|sheets)_/, "");
}

function rowsLabel(q: QueryRecord) {
  if (q.error) return "failed";
  const rows = `${q.rowCount.toLocaleString("en-IN")} ${q.rowCount === 1 ? "row" : "rows"}`;
  return q.truncated ? `${rows} (limited)` : rows;
}

export function QueriesUsed({
  queries,
  defaultOpen = false,
  id,
}: {
  queries: QueryRecord[];
  defaultOpen?: boolean;
  /** DOM id of the panel (the sources panel links here). */
  id?: string;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const autoId = React.useId();
  const panelId = id ?? autoId;
  if (!queries.length) return null;

  const failed = queries.filter((q) => q.error).length;
  const totalMs = queries.reduce((n, q) => n + (q.durationMs || 0), 0);
  const collections = Array.from(new Set(queries.map((q) => q.collection).filter(Boolean)));

  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-st-secondary bg-sf-white">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] transition-colors duration-200 ease-standard hover:bg-bg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-400"
      >
        <Database className="size-3.5 shrink-0 text-tx-tertiary" strokeWidth={1.5} aria-hidden="true" />
        <span className="shrink-0 font-medium text-tx-secondary">
          {queries.length === 1 ? "1 query used" : `${queries.length} queries used`}
        </span>
        {collections.length ? (
          <span className="min-w-0 truncate text-tx-tertiary">· {collections.join(", ")}</span>
        ) : null}
        {failed ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-yellow-700">
            <TriangleAlert className="size-3" strokeWidth={1.5} aria-hidden="true" />
            {failed} failed
          </span>
        ) : null}
        <span className="ml-auto shrink-0 tabular-nums text-tx-muted">· {totalMs.toLocaleString("en-IN")}ms</span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-tx-muted transition-transform duration-200 ease-standard", open && "rotate-180")}
          strokeWidth={1.5}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <ul id={panelId} className="divide-y divide-st-secondary border-t border-st-secondary">
          {queries.map((q, i) => (
            // A finished message's queries never reorder; tool + target + index is stable.
            <li key={`${q.tool}-${q.db}-${q.collection}-${i}`} className="flex flex-col gap-2 px-3.5 py-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
                <span className="rounded-md border border-indigo-100 bg-indigo-50 px-1.5 py-px font-mono text-[11px] text-indigo-800">
                  {toolLabel(q.tool)}
                </span>
                <span className="font-mono text-[12px] text-tx">
                  {q.db ? `${q.db}.` : ""}
                  {q.collection}
                </span>
                {q.connectionName ? <span className="text-tx-muted">on {q.connectionName}</span> : null}
                <span className="ml-auto tabular-nums text-tx-tertiary">
                  {rowsLabel(q)} · {q.durationMs}ms
                </span>
              </div>
              {q.error ? <p className="text-[13px] text-red-400">{q.error}</p> : null}
              <div className="relative [&_.code]:my-0">
                <HighlightedCode language="json" value={q.query} />
              </div>
              <div className="-mt-1 flex justify-end">
                <CopyButton value={q.query} label="Copy query" showLabel />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
