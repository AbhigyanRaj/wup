"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, ClipboardCopy, FileSpreadsheet, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { TableShell, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table-shell";
import { cn } from "@/lib/cn";
import { cellText, isEmptyCell, prepareTable, sortRows, type ColumnType } from "@/lib/charts/columns";
import { rowsToCsv, rowsToTsv } from "@/lib/export/csv";
import { copyText, downloadText, safeFilename } from "@/lib/export/download";
import { RendererShell } from "../renderer-shell";
import { ActionIcon, CopyAction } from "../renderer-actions";

/*
 * Data table: columns from `columns` or the union of row keys, detected column
 * types (numbers right aligned and sorted as numbers), tri-state sorting with
 * empty values last, a filter above 10 rows, sticky header, CSV and TSV export.
 */

const FILTER_FROM = 10;
const RENDER_CAP = 1000;

type Sort = { column: string; dir: "asc" | "desc" } | null;

export interface DataTableProps {
  columns?: unknown;
  rows?: unknown;
  title?: string;
  caption?: string;
  /** Render without the card shell (inside a chart card or accordion). */
  embedded?: boolean;
  maxHeight?: number;
  className?: string;
}

function Cell({ value, type }: { value: unknown; type: ColumnType }) {
  if (isEmptyCell(value)) return <span className="text-tx-muted" aria-label="empty" />;
  if (typeof value === "object") {
    const json = cellText(value);
    return (
      <code title={json.length > 40 ? json : undefined} className="block max-w-[280px] truncate font-mono text-[12px] leading-5 text-tx-secondary">
        {json.length > 80 ? `${json.slice(0, 79)}…` : json}
      </code>
    );
  }
  if (typeof value === "boolean") return <span className="font-mono text-[13px] text-tx-secondary">{String(value)}</span>;
  const text = String(value);
  if (type === "number") return <>{text}</>;
  return <span className="line-clamp-3 break-words">{text}</span>;
}

export function DataTable({ columns: columnsIn, rows: rowsIn, title, caption, embedded, maxHeight = 420, className }: DataTableProps) {
  const table = useMemo(() => prepareTable(columnsIn, rowsIn), [columnsIn, rowsIn]);
  const [sort, setSort] = useState<Sort>(null);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const { columns, types, rows } = table;

  const visible = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) => columns.some((c) => cellText(r[c]).toLowerCase().includes(q)))
      : rows;
    return sort ? sortRows(filtered, sort.column, types[sort.column] ?? "string", sort.dir) : filtered;
  }, [rows, columns, types, sort, deferredQuery]);

  const cycle = (column: string) =>
    setSort((s) =>
      s?.column !== column ? { column, dir: "asc" } : s.dir === "asc" ? { column, dir: "desc" } : null,
    );

  const exportRows = () => visible.map((r) => Object.fromEntries(columns.map((c) => [c, r[c]])));
  const name = safeFilename(title, "wuup-table");
  const showFilter = rows.length > FILTER_FROM;
  const countText = deferredQuery.trim() ? `${visible.length} of ${rows.length} rows` : `${rows.length} ${rows.length === 1 ? "row" : "rows"}`;

  const actions = (
    <>
      <CopyAction
        label="Copy as TSV"
        doneLabel="Copied as TSV"
        icon={<ClipboardCopy aria-hidden="true" strokeWidth={1.5} />}
        getText={() => rowsToTsv(columns, exportRows())}
        copy={copyText}
      />
      <ActionIcon label="Download CSV" onClick={() => downloadText(rowsToCsv(columns, exportRows()), `${name}.csv`, "text/csv")}>
        <FileSpreadsheet aria-hidden="true" strokeWidth={1.5} />
      </ActionIcon>
    </>
  );

  const filter = showFilter ? (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        type="search"
        aria-label="Filter rows"
        placeholder="Filter rows"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        leading={<Search />}
        trailing={
          query ? (
            <button
              type="button"
              aria-label="Clear filter"
              onClick={() => setQuery("")}
              className="inline-flex size-7 items-center justify-center rounded-full text-tx-muted hover:bg-sf-secondary hover:text-tx focus-visible:outline-2 focus-visible:outline-indigo-400"
            >
              <X />
            </button>
          ) : undefined
        }
        className="min-h-9 py-1.5 sm:text-[14px] [&::-webkit-search-cancel-button]:hidden"
        wrapperClassName="w-full sm:w-[240px]"
      />
      <span className="text-[13px] tabular-nums text-tx-tertiary" aria-live="polite">
        {countText}
      </span>
    </div>
  ) : null;

  if (columns.length === 0) {
    const empty = <p className="py-8 text-center text-[14px] text-tx-tertiary">No rows to show</p>;
    return embedded ? empty : <RendererShell title={title ?? "Results"}>{empty}</RendererShell>;
  }

  const shown = visible.slice(0, RENDER_CAP);
  const grid = (
    <TableShell
      stickyHeader
      maxHeight={maxHeight}
      caption={title ?? "Data table"}
      className={cn(embedded ? "rounded-xl!" : "rounded-none! border-x-0! border-b-0!")}
    >
      <Thead>
        <Tr>
          {columns.map((c) => {
            const numeric = types[c] === "number";
            const sorted = sort?.column === c ? sort.dir : null;
            const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ChevronsUpDown;
            return (
              <Th
                key={c}
                numeric={numeric}
                aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"}
                className="px-4! py-0! first:pl-5! last:pr-5! sm:first:pl-6! sm:last:pr-6!"
              >
                <button
                  type="button"
                  onClick={() => cycle(c)}
                  className={cn(
                    "group/sort -mx-1.5 inline-flex h-10 items-center gap-1.5 rounded-md px-1.5 uppercase tracking-[0.08em] transition-colors duration-150",
                    "hover:text-tx focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-indigo-400",
                    sorted ? "text-tx" : "text-tx-tertiary",
                    numeric && "flex-row-reverse",
                  )}
                >
                  <span>{c}</span>
                  <Icon
                    aria-hidden="true"
                    strokeWidth={1.75}
                    className={cn(
                      "size-3.5 shrink-0",
                      sorted ? "text-indigo-800" : "text-tx-muted opacity-70 group-hover/sort:opacity-100",
                    )}
                  />
                </button>
              </Th>
            );
          })}
        </Tr>
      </Thead>
      <Tbody>
        {shown.length === 0 ? (
          <Tr>
            <Td colSpan={columns.length} className="py-8! text-center text-tx-tertiary!">
              No rows match &ldquo;{deferredQuery.trim()}&rdquo;
            </Td>
          </Tr>
        ) : (
          shown.map((r) => (
            <Tr key={r.__rowId} className="hover:bg-[#fafafa]">
              {columns.map((c) => (
                <Td
                  key={c}
                  numeric={types[c] === "number"}
                  className={cn(
                    "px-4! py-2.5! first:pl-5! last:pr-5! sm:first:pl-6! sm:last:pr-6!",
                    types[c] === "number" ? "whitespace-nowrap" : "min-w-[96px] max-w-[360px]",
                  )}
                >
                  <Cell value={r[c]} type={types[c] ?? "string"} />
                </Td>
              ))}
            </Tr>
          ))
        )}
      </Tbody>
    </TableShell>
  );

  const capNote =
    visible.length > RENDER_CAP ? (
      <p className="px-6 py-2 text-[13px] text-tx-tertiary">
        Showing the first {RENDER_CAP} of {visible.length} rows. Download the CSV for all of them.
      </p>
    ) : null;

  if (embedded) {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        {filter}
        {grid}
        {capNote}
      </div>
    );
  }

  return (
    <RendererShell
      flush
      title={title ?? "Results"}
      caption={caption ?? (showFilter ? undefined : `${countText}, ${columns.length} ${columns.length === 1 ? "column" : "columns"}`)}
      actions={actions}
      className={className}
    >
      {filter ? <div className="px-4 pb-4 sm:px-6">{filter}</div> : null}
      {grid}
      {capNote}
    </RendererShell>
  );
}

export { DataTable as default };
