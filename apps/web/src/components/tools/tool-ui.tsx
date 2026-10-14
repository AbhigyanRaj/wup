"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Check, Info, Lightbulb, ShieldCheck } from "lucide-react";
import { CodeBlock } from "@/components/ui/code-block";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { SIGNUP } from "@/lib/site";
import { CODE_LANGS, formatQuery, type MongoQuery } from "@/lib/tools/mongo-format";
import type { ToolError } from "@/lib/tools/api";
import { highlight } from "./code-tokens";

/* ------------------------------------------------------------------ */
/* Example events                                                      */
/* ------------------------------------------------------------------ */

export const EXAMPLE_EVENT = "wuup:tool-example";

export interface ExampleEventDetail {
  tool: string;
  id: string;
}

/** Fired by the "Try this example" buttons in the examples grid. */
export function dispatchExample(detail: ExampleEventDetail) {
  window.dispatchEvent(new CustomEvent<ExampleEventDetail>(EXAMPLE_EVENT, { detail }));
}

/** Calls `onExample(id)` when an example for this tool is chosen anywhere on the page. */
export function useExampleListener(tool: string, onExample: (id: string) => void) {
  const cb = useRef(onExample);
  useEffect(() => {
    cb.current = onExample;
  });
  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent<ExampleEventDetail>).detail;
      if (d?.tool === tool) cb.current(d.id);
    };
    window.addEventListener(EXAMPLE_EVENT, handler);
    return () => window.removeEventListener(EXAMPLE_EVENT, handler);
  }, [tool]);
}

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

/** Kit api-tts gradient bezel around the playground card. */
export function Bezel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative rounded-[28px] p-1.5 shadow-[0_0_0_3px_rgba(0,0,0,0.05)] md:rounded-[56px] md:p-10 lg:p-12", className)}>
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-[28px] bg-[linear-gradient(180deg,#a9c4fb_0%,#dbeafe_55%,#f1f7ff_100%)] shadow-[inset_0_0_25px_10px_rgba(255,255,255,0.5)] md:rounded-[52px]"
      />
      <div aria-hidden="true" className="absolute inset-0 rounded-[28px] bg-[image:var(--noise-url)] opacity-40 mix-blend-soft-light md:rounded-[52px]" />
      <div className="relative overflow-hidden rounded-[22px] border border-st-secondary bg-bg md:rounded-2xl">{children}</div>
    </div>
  );
}

export function FieldLabel({ htmlFor, children, hint }: { htmlFor: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <label htmlFor={htmlFor} className="text-caption font-medium text-tx-secondary">
        {children}
      </label>
      {hint ? <span className="text-label text-tx-tertiary tabular-nums">{hint}</span> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Results                                                             */
/* ------------------------------------------------------------------ */

const LANG_HL = { mongosh: "js", node: "js", python: "python" } as const;

/** mongosh / Node.js / Python tabs for a query. */
export function QueryCode({ query, className }: { query: MongoQuery; className?: string }) {
  return (
    <CodeBlock
      className={className}
      preClassName="max-h-[460px]"
      tabs={CODE_LANGS.map((l) => {
        const code = formatQuery(query, l.id);
        return { label: l.label, code, content: highlight(code, LANG_HL[l.id]) };
      })}
    />
  );
}

export interface NotesProps {
  explanation?: string[];
  assumptions?: string[];
  warnings?: string[];
  explanationTitle?: string;
  assumptionsTitle?: string;
}

/** Explanation bullets, assumptions and warnings. */
export function ResultNotes({ explanation = [], assumptions = [], warnings = [], explanationTitle = "How it works", assumptionsTitle = "Assumptions" }: NotesProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {explanation.length ? (
        <div className="rounded-2xl border border-st-secondary bg-sf-white p-5 md:col-span-2">
          <p className="mb-3 flex items-center gap-2 text-caption font-medium text-tx">
            <Lightbulb className="size-4 text-indigo-600" strokeWidth={1.75} aria-hidden="true" />
            {explanationTitle}
          </p>
          <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
            {explanation.map((e, i) => (
              <li key={i} className="flex gap-3 text-[15px] leading-[1.55] text-tx-secondary">
                <span className="mt-[1px] grid size-5 shrink-0 place-items-center rounded-full bg-indigo-50 text-[11px] font-medium text-indigo-800 tabular-nums">
                  {i + 1}
                </span>
                {e}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {assumptions.length ? (
        <NoteList icon={<Info className="size-4 text-sky-700" strokeWidth={1.75} aria-hidden="true" />} title={assumptionsTitle} items={assumptions} tone="sky" />
      ) : null}
      {warnings.length ? (
        <NoteList icon={<AlertTriangle className="size-4 text-yellow-700" strokeWidth={1.75} aria-hidden="true" />} title="Warnings" items={warnings} tone="yellow" />
      ) : null}
    </div>
  );
}

function NoteList({ icon, title, items, tone }: { icon: ReactNode; title: string; items: string[]; tone: "sky" | "yellow" }) {
  return (
    <div className={cn("rounded-2xl border p-5", tone === "sky" ? "border-sky-100 bg-sky-50/60" : "border-yellow-200 bg-yellow-50/70")}>
      <p className="mb-2.5 flex items-center gap-2 text-caption font-medium text-tx">
        {icon}
        {title}
      </p>
      <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-caption leading-[1.55] text-tx-secondary marker:text-tx-muted">
        {items.map((a, i) => (
          <li key={i}>{a}</li>
        ))}
      </ul>
    </div>
  );
}

/** Small table of rows (example result previews). */
export function PreviewTable({ columns, rows, caption }: { columns: string[]; rows: Array<Array<string | number | boolean | null>>; caption?: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-st-secondary bg-sf-white">
      <table className="w-full border-collapse text-[13px]">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="bg-sf-secondary/50">
            {columns.map((c) => (
              <th key={c} scope="col" className="whitespace-nowrap border-b border-st-secondary px-3 py-2 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-tx-tertiary">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-3 text-tx-tertiary">
                No documents match (that is the expected result here).
              </td>
            </tr>
          ) : (
            rows.map((r, ri) => (
              <tr key={ri} className="border-b border-st-secondary last:border-0">
                {r.map((cell, ci) => (
                  <td key={ci} className={cn("whitespace-nowrap px-3 py-2 text-tx-secondary", typeof cell === "number" && "text-right tabular-nums", ci === 0 && "text-tx")}>
                    {cell === null ? <span className="text-tx-muted">null</span> : String(cell)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Errors and CTAs                                                     */
/* ------------------------------------------------------------------ */

export function ToolErrorNote({ error }: { error: ToolError }) {
  if (error.status === 429) {
    return (
      <div role="alert" className="flex flex-col gap-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-5 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="text-body font-medium text-tx">You&apos;ve hit the free tool limit</p>
          <p className="mt-1 text-caption leading-[1.55] text-tx-secondary">
            {error.message} {error.retryAfterS ? `Try again in about ${formatWait(error.retryAfterS)}.` : ""}
          </p>
        </div>
        <ButtonLink href={SIGNUP} variant="ink" size="sm" arrow>
          Sign up free
        </ButtonLink>
      </div>
    );
  }
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-caption leading-[1.55] text-tx-secondary">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-400" strokeWidth={1.75} aria-hidden="true" />
      <p>{error.message}</p>
    </div>
  );
}

function formatWait(s: number) {
  if (s < 90) return `${Math.max(1, Math.round(s))} seconds`;
  if (s < 5400) return `${Math.round(s / 60)} minutes`;
  return `${Math.round(s / 3600)} hours`;
}

/** "Run this on your real database, read-only" card. */
export function RealDbCta({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-st-secondary bg-sf-white",
        compact ? "p-5" : "p-6 md:p-7",
      )}
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-[radial-gradient(circle,#c7d7fe_0%,transparent_70%)]" />
      <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-800">
            <ShieldCheck className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div>
            <p className="text-body font-medium text-tx">Run this on your real database, read-only</p>
            <p className="mt-1 max-w-[52ch] text-caption leading-[1.55] text-tx-tertiary">
              Connect MongoDB with a read-only user and wuup writes, checks and runs queries like this for you, then answers with a chart or table.
            </p>
          </div>
        </div>
        <ButtonLink href={SIGNUP} variant="ink" arrow className="shrink-0 self-start md:self-center">
          Start free
        </ButtonLink>
      </div>
    </div>
  );
}

/** Small status line under a result. */
export function ResultMeta({ source, cached }: { source: "api" | "example"; cached?: boolean }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-label text-tx-tertiary">
      <span className="inline-flex items-center gap-1.5">
        <Check className="size-3.5 text-green-600" strokeWidth={2} aria-hidden="true" />
        {source === "example" ? "Worked example, run against the sample data" : "Checked by the read-only guard"}
      </span>
      {cached ? <span>Served from cache</span> : null}
      <Link href="/security" className="inline-flex items-center gap-1 text-indigo-700 hover:text-indigo-900">
        How queries are checked <ArrowRight className="size-3" aria-hidden="true" />
      </Link>
    </p>
  );
}

/** Kit "play" button: 56px dark circle, used as the generate action. */
export function RunButton({ busy, label, onClick, disabled }: { busy: boolean; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className={cn(
        "btn btn--ink relative h-12 gap-2 px-5 disabled:cursor-not-allowed disabled:opacity-60",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400",
      )}
    >
      {busy ? (
        <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />
      ) : null}
      <span>{busy ? "Working..." : label}</span>
      {busy ? null : <ArrowRight className="size-4" aria-hidden="true" />}
    </button>
  );
}
