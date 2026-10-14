"use client";

import { CircleCheck } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { totalDocuments, type BridgeDetails, type BridgeSummary } from "@/lib/bridges";
import { ErrorCallout, TryAsking } from "./parts";

/** "Learning your data" while the bridge is created and its schema is sampled. */
export function SavingView({
  title = "Learning your data",
  body,
  progress,
}: {
  title?: string;
  body: string;
  progress?: string | null;
}) {
  return (
    <div className="flex flex-col items-center px-2 py-10 text-center" role="status" aria-live="polite">
      <div className="relative grid size-16 place-items-center rounded-2xl bg-blue-50 shadow-[inset_0_0_0_1px_var(--color-st-secondary)]">
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_50%_120%,#bfdbfe_0%,transparent_70%)] opacity-80"
        />
        <Spinner size="lg" label={null} className="relative" />
      </div>
      <p className="mt-5 text-[18px] font-medium tracking-[-0.01em] text-tx">{title}</p>
      <p className="mt-1.5 max-w-[340px] text-[14px] leading-[1.6] text-tx-tertiary">{body}</p>
      {progress ? <p className="mt-3 text-[13px] tabular-nums text-tx-secondary">{progress}</p> : null}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-st-secondary bg-sf-white px-4 py-3">
      <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-tx-tertiary">{label}</p>
      <p className="mt-1 text-[20px] font-medium tabular-nums tracking-[-0.5px] text-tx">{value}</p>
    </div>
  );
}

/** Success card, stats and "Try asking" chips. */
export function ReadyView({
  bridge,
  onNavigate,
}: {
  bridge: BridgeDetails | BridgeSummary;
  onNavigate: () => void;
}) {
  const isSheets = bridge.type === "sheets";
  const docs = "schema" in bridge ? totalDocuments(bridge) : null;
  const rows = isSheets ? (bridge.sheets?.tabs.reduce((n, t) => n + t.rows, 0) ?? null) : null;
  const stats = isSheets
    ? [
        { label: "Tabs", value: String(bridge.sheets?.tabs.length ?? bridge.stats.collections) },
        { label: "Rows", value: rows === null ? "-" : rows.toLocaleString("en-US") },
      ]
    : [
        { label: "Databases", value: bridge.stats.databases.toLocaleString("en-US") },
        { label: "Collections", value: bridge.stats.collections.toLocaleString("en-US") },
        { label: "Documents", value: docs === null ? "-" : docs.toLocaleString("en-US") },
      ];

  return (
    <div className="flex flex-col gap-5" data-testid="wizard-ready">
      {bridge.status === "error" ? (
        <ErrorCallout
          error={{
            title: "Connected, but the schema scan failed",
            message: bridge.lastError ?? "",
            hint: "Open the source and use Refresh schema to try again.",
          }}
        />
      ) : (
        <div className="relative overflow-hidden rounded-2xl border border-green-100 bg-green-50/70 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sf-white shadow-[inset_0_0_0_1px_var(--green-100)]">
              <CircleCheck className="size-5 text-green-600" strokeWidth={1.5} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[16px] font-medium text-tx">{bridge.name} is ready</p>
              <p className="text-[14px] text-tx-tertiary">
                {bridge.status === "scanning"
                  ? "Still sampling a few collections. You can ask questions now."
                  : "wuup knows your schema. Ask anything in plain English."}
              </p>
            </div>
          </div>
        </div>
      )}
      <div className={cn("grid gap-2", stats.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
        {stats.map((s) => (
          <StatTile key={s.label} {...s} />
        ))}
      </div>
      <TryAsking suggestions={bridge.suggestions.slice(0, 4)} onNavigate={onNavigate} layout="stack" />
    </div>
  );
}
