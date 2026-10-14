"use client";

import { useId, useState } from "react";
import dynamic from "next/dynamic";
import { ChevronDown, Table2 } from "lucide-react";
import type { MessageDTO } from "@wup/contracts";
import { cn } from "@/lib/cn";
import { RendererBoundary } from "./renderer-boundary";
import { RendererSkeleton } from "./renderer-skeleton";

/*
 * Public: renders the structured visual attached to an assistant message
 * (chart, table or diagram). Every renderer loads lazily behind a skeleton and
 * sits in a RendererBoundary that falls back to the rows or raw JSON.
 * visualType "mermaid" is drawn from the markdown fence (MermaidBlock), not here.
 */

const ChartBlock = dynamic(() => import("./chart/chart-block").then((m) => m.ChartBlock), {
  ssr: false,
  loading: () => <RendererSkeleton kind="chart" />,
});
const DataTable = dynamic(() => import("./table/data-table").then((m) => m.DataTable), {
  ssr: false,
  loading: () => <RendererSkeleton kind="table" />,
});
const DiagramBlock = dynamic(() => import("./diagram/diagram-block").then((m) => m.DiagramBlock), {
  ssr: false,
  loading: () => <RendererSkeleton kind="diagram" />,
});

export type VisualMessage = Pick<MessageDTO, "visualType" | "chartData" | "tableData" | "diagramData">;

function rowsOf(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null) : [];
}

export function VisualBlock({ message }: { message: VisualMessage }) {
  const { visualType, chartData, tableData, diagramData } = message ?? ({} as VisualMessage);
  const tableRows = rowsOf(tableData?.rows);

  if (visualType === "chart" && chartData) {
    const rows = rowsOf(chartData.series);
    return (
      <RendererBoundary rows={rows.length ? rows : tableRows} raw={chartData} title={chartData.title}>
        <ChartBlock chart={chartData} />
      </RendererBoundary>
    );
  }

  if (visualType === "diagram" && diagramData) {
    return (
      <RendererBoundary raw={diagramData} title="Diagram">
        <DiagramBlock diagram={diagramData} />
      </RendererBoundary>
    );
  }

  if ((visualType === "table" || visualType === "chart") && tableData) {
    return (
      <RendererBoundary rows={tableRows} columns={tableData.columns} raw={tableData}>
        <DataTable columns={tableData.columns} rows={tableData.rows} title="Results" />
      </RendererBoundary>
    );
  }

  if (tableData && tableRows.length > 0) {
    return <RowsAccordion columns={tableData.columns} rows={tableRows} />;
  }

  return null;
}

/** visualType "none" with rows attached: a quiet, collapsed "View rows (N)". */
function RowsAccordion({ columns, rows }: { columns?: string[]; rows: Record<string, unknown>[] }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="w-full min-w-0 rounded-card border border-st-secondary bg-sf-white">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-card px-4 py-3 text-left text-[14px] font-medium text-tx transition-colors duration-150 hover:bg-[#fafafa] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 sm:px-5"
      >
        <Table2 className="size-4 shrink-0 text-tx-tertiary" strokeWidth={1.5} aria-hidden="true" />
        <span className="flex-1">
          View rows <span className="tabular-nums text-tx-tertiary">({rows.length})</span>
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-tx-tertiary transition-transform duration-200 ease-standard", open && "rotate-180")}
          strokeWidth={1.5}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div id={id} className="px-3 pb-3 sm:px-4 sm:pb-4">
          <RendererBoundary rows={rows} columns={columns}>
            <DataTable embedded columns={columns} rows={rows} title="Rows" maxHeight={360} />
          </RendererBoundary>
        </div>
      ) : null}
    </div>
  );
}

export default VisualBlock;
