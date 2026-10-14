"use client";

import { memo, useRef, useState } from "react";
import { FileCode2, FileImage, FileSpreadsheet } from "lucide-react";
import { SegmentedControl } from "@/components/ui/tabs";
import { normalizeChart, type NormalizedChart } from "@/lib/charts/normalize";
import { rowsToCsv } from "@/lib/export/csv";
import { downloadBlob, downloadText, safeFilename } from "@/lib/export/download";
import { svgToPngBlob } from "@/lib/export/png";
import { serializeSvg, svgBlob } from "@/lib/export/svg";
import { RendererShell } from "../renderer-shell";
import { ExportMenu, type ExportItem } from "../renderer-actions";
import { useElementWidth, useSvgId } from "../hooks";
import { DataTable } from "../table/data-table";
import { CartesianChart } from "./cartesian-chart";
import { PieChart } from "./pie-chart";

/*
 * Chart card. normalizeChart runs first and hook free, so bad payloads become a
 * table ("Shown as a table") before any chart hook sees them.
 */

export interface ChartBlockProps {
  chart: unknown;
}

export const ChartBlock = memo(function ChartBlock({ chart }: ChartBlockProps) {
  const result = normalizeChart(chart);
  if (!result.ok) {
    return <DataTable title={result.title} caption={result.message} columns={result.columns} rows={result.rows} />;
  }
  return <ChartCard chart={result.chart} />;
});

const KIND_LABEL: Record<NormalizedChart["kind"], string> = {
  bar: "Bar chart",
  hbar: "Bar chart",
  line: "Line chart",
  pie: "Donut chart",
};

function ChartCard({ chart }: { chart: NormalizedChart }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const svgRef = useRef<SVGSVGElement>(null);
  const [bodyRef, width] = useElementWidth<HTMLDivElement>();
  const labelId = useSvgId("chart-title");
  const name = safeFilename(chart.title, "wuup-chart");
  const n = chart.points.length;
  const ariaLabel = `${chart.title}. ${KIND_LABEL[chart.kind]} with ${n} ${n === 1 ? "value" : "values"}. Use the arrow keys to read each value.`;

  const exportSvg = () => {
    if (!svgRef.current) throw new Error("Switch to the chart view to export an image");
    return serializeSvg(svgRef.current, { padding: 24, title: chart.title });
  };

  const items: ExportItem[] = [
    ...(view === "chart" && !chart.empty
      ? [
          {
            label: "Download PNG",
            icon: <FileImage />,
            onSelect: async () => downloadBlob(await svgToPngBlob(exportSvg(), 2), `${name}.png`),
          },
          {
            label: "Download SVG",
            icon: <FileCode2 />,
            onSelect: () => downloadBlob(svgBlob(exportSvg()), `${name}.svg`),
          },
        ]
      : []),
    {
      label: "Download CSV",
      icon: <FileSpreadsheet />,
      onSelect: () => downloadText(rowsToCsv(chart.columns, chart.rows), `${name}.csv`, "text/csv"),
    },
  ];

  const caption = chart.notes.length ? chart.notes.join(", ") : undefined;

  return (
    <RendererShell
      labelId={labelId}
      title={chart.title}
      caption={caption}
      controls={
        <SegmentedControl
          size="sm"
          aria-label="Chart view"
          value={view}
          onChange={setView}
          options={[
            { value: "chart", label: "Chart" },
            { value: "table", label: "Table" },
          ]}
        />
      }
      actions={<ExportMenu items={items} />}
    >
      <div ref={bodyRef} className="w-full min-w-0">
        {view === "table" ? (
          <DataTable embedded title={chart.title} columns={chart.columns} rows={chart.rows} maxHeight={360} />
        ) : chart.empty ? (
          <div className="flex h-[160px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-st bg-[#fcfcfc] px-6 text-center">
            <p className="text-[15px] font-medium text-tx">No values to chart</p>
            <p className="text-[13px] text-tx-tertiary">Every value is zero or below. Switch to Table to see the rows.</p>
          </div>
        ) : width === 0 ? (
          <div style={{ height: chart.kind === "pie" ? 264 : 288 }} />
        ) : chart.kind === "pie" ? (
          <PieChart chart={chart} width={width} svgRef={svgRef} ariaLabel={ariaLabel} />
        ) : (
          <CartesianChart chart={chart} width={width} svgRef={svgRef} ariaLabel={ariaLabel} />
        )}
      </div>
    </RendererShell>
  );
}

export { ChartBlock as default };
