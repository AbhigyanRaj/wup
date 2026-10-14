"use client";

import Link from "next/link";
import { CircleAlert, ShieldCheck, Lightbulb } from "lucide-react";
import { Pill } from "@/components/ui/pill";
import { cn } from "@/lib/cn";
import { askHref, type BridgeSummary } from "@/lib/bridges";
import { FACTS } from "@/lib/site";
import type { ConnectionErrorInfo } from "./connection-errors";

/** "just now", "5m ago", "2h ago", "3d ago", or a date. */
export function timeAgo(iso: string | null | undefined, never = "Never"): string {
  if (!iso) return never;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return never;
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "";
}

export function BridgeStatusPill({ status, className }: { status: BridgeSummary["status"]; className?: string }) {
  if (status === "scanning")
    return (
      <Pill tone="warning" dot className={className}>
        Scanning
      </Pill>
    );
  if (status === "error")
    return (
      <Pill tone="error" dot className={className}>
        Needs attention
      </Pill>
    );
  return (
    <Pill tone="success" dot className={className}>
      Active
    </Pill>
  );
}

export const TYPE_LABEL: Record<string, string> = {
  mongodb: "MongoDB",
  sheets: "Google Sheets",
  postgresql: "PostgreSQL",
  supabase: "Supabase",
};

/** Red callout with a headline, the server message and a hint. */
export function ErrorCallout({ error, className }: { error: ConnectionErrorInfo | string; className?: string }) {
  const e = typeof error === "string" ? { title: error, message: "" } : error;
  return (
    <div
      role="alert"
      className={cn("flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3", className)}
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-red-400" strokeWidth={1.5} aria-hidden="true" />
      <div className="min-w-0 text-[14px] leading-[1.55]">
        <p className="font-medium text-tx">{e.title}</p>
        {e.message && e.message !== e.title ? <p className="mt-0.5 break-words text-tx-secondary">{e.message}</p> : null}
        {"hint" in e && e.hint ? <p className="mt-1.5 text-tx-tertiary">{e.hint}</p> : null}
      </div>
    </div>
  );
}

/** The green read-only assurance card. */
export function ReadOnlyCard({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border border-green-100 bg-green-50 px-4 py-3", className)}>
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-green-600" strokeWidth={1.5} aria-hidden="true" />
      <p className="text-[14px] leading-[1.55] text-tx-secondary">
        <span className="font-medium text-tx">wuup only reads.</span> Writes, <code className="font-mono text-[13px]">$out</code>,{" "}
        <code className="font-mono text-[13px]">$merge</code> and server-side JavaScript are blocked, and every query is capped
        at {FACTS.maxRowsPerQuery} rows and {FACTS.queryTimeoutS} seconds.
      </p>
    </div>
  );
}

/** "Try asking" suggestion chips linking into a new chat. */
export function TryAsking({
  suggestions,
  onNavigate,
  className,
  layout = "wrap",
}: {
  suggestions: string[];
  onNavigate?: () => void;
  className?: string;
  layout?: "wrap" | "stack";
}) {
  if (!suggestions.length) return null;
  return (
    <section className={cn("flex flex-col gap-2.5", className)} aria-label="Try asking">
      <p className="flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-[0.08em] text-tx-tertiary">
        <Lightbulb className="size-3.5 text-indigo-600" strokeWidth={1.5} aria-hidden="true" />
        Try asking
      </p>
      <div className={cn(layout === "wrap" ? "flex flex-wrap gap-2" : "flex flex-col gap-2")}>
        {suggestions.map((q) => (
          <Link
            key={q}
            href={askHref(q)}
            onClick={onNavigate}
            className={cn(
              "rounded-xl border border-st bg-sf-white px-3.5 py-2 text-left text-[14px] leading-[1.45] text-tx-secondary",
              "transition-colors duration-200 ease-standard hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-800",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400",
            )}
          >
            {q}
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Uppercase 12px section label used inside dialogs and the drawer. */
export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-[12px] font-medium uppercase tracking-[0.08em] text-tx-tertiary", className)}>{children}</p>
  );
}
