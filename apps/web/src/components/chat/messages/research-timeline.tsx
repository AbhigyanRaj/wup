"use client";

import * as React from "react";
import { Check, ChevronDown, Telescope, X } from "lucide-react";
import type { ResearchStep } from "@/lib/types";
import { cn } from "@/lib/cn";
import styles from "./thinking.module.css";

/*
 * Research plan as a vertical rail. While running every step is visible; once
 * the report is done it collapses to "Researched for 18s · 6 steps".
 */

function seconds(ms: number) {
  const s = Math.max(1, Math.round(ms / 1000));
  return s >= 90 ? `${Math.round(s / 60)}m` : `${s}s`;
}

function StepDot({ status }: { status: ResearchStep["status"] }) {
  const base = "relative z-[1] flex size-[18px] shrink-0 items-center justify-center rounded-full";
  if (status === "done")
    return (
      <span className={cn(base, "bg-indigo-600 text-white")}>
        <Check className="size-[11px]" strokeWidth={2.5} aria-hidden="true" />
      </span>
    );
  if (status === "error")
    return (
      <span className={cn(base, "bg-red-50 text-red-400 ring-1 ring-red-100")}>
        <X className="size-[11px]" strokeWidth={2.5} aria-hidden="true" />
      </span>
    );
  if (status === "running")
    return (
      <span className={cn(base, "bg-white ring-1 ring-indigo-300")}>
        <span className={styles.dot} style={{ margin: 0 }} />
      </span>
    );
  return <span className={cn(base, "bg-white ring-1 ring-st", status === "skipped" && "opacity-50")} />;
}

const STATUS_LABEL: Record<ResearchStep["status"], string> = {
  pending: "Waiting",
  running: "In progress",
  done: "Done",
  error: "Failed",
  skipped: "Skipped",
};

export function ResearchTimeline({
  steps,
  running,
  durationMs,
  onOpenSource,
}: {
  steps: ResearchStep[];
  running: boolean;
  durationMs: number | null;
  onOpenSource?: (n: number) => void;
}) {
  const [open, setOpen] = React.useState(running);
  const [wasRunning, setWasRunning] = React.useState(running);
  if (wasRunning !== running) {
    setWasRunning(running);
    setOpen(running);
  }
  const id = React.useId();
  if (!steps.length) return null;
  const done = steps.filter((s) => s.status === "done").length;

  return (
    <section className="mb-5 rounded-2xl border border-st-secondary bg-sf-white" aria-label="Research plan">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-2xl px-4 py-3 text-left transition-colors duration-200 ease-standard hover:bg-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-indigo-50 text-indigo-800 ring-1 ring-indigo-100">
          <Telescope className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 text-[14px] text-tx-secondary">
          {running ? (
            <>
              <span className={cn("font-medium", styles.shimmer)}>Researching</span>
              <span className="text-tx-muted">
                {" "}
                · step {Math.min(done + 1, steps.length)} of {steps.length}
              </span>
            </>
          ) : (
            <>
              <span className="font-medium text-tx">
                Researched{durationMs ? ` for ${seconds(durationMs)}` : ""}
              </span>
              <span className="text-tx-muted">
                {" "}
                · {steps.length} {steps.length === 1 ? "step" : "steps"}
              </span>
            </>
          )}
        </span>
        <ChevronDown
          className={cn("size-4 text-tx-muted transition-transform duration-200 ease-standard", open && "rotate-180")}
          strokeWidth={1.5}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <ol id={id} className="relative px-4 pb-4 pt-1">
          {steps.map((step, i) => (
            <li key={step.id} className="relative flex gap-3 pb-4 last:pb-0">
              {i < steps.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute left-[8.5px] top-[20px] bottom-0 w-px",
                    step.status === "done" ? "bg-indigo-200" : "bg-st",
                  )}
                />
              ) : null}
              <span className="pt-[3px]">
                <StepDot status={step.status} />
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-[14px] leading-6",
                    step.status === "pending" || step.status === "skipped" ? "text-tx-muted" : "font-medium text-tx",
                  )}
                >
                  {step.title}
                  <span className="sr-only">, {STATUS_LABEL[step.status]}</span>
                </p>
                {step.detail || step.sourceNs.length ? (
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    {step.detail ? <span className="text-[13px] leading-5 text-tx-tertiary">{step.detail}</span> : null}
                    {step.sourceNs.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => onOpenSource?.(n)}
                        disabled={!onOpenSource}
                        aria-label={`Open source ${n}`}
                        className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 px-[5px] text-[11px] font-medium tabular-nums text-indigo-800 transition-colors hover:bg-indigo-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-400 disabled:cursor-default disabled:hover:bg-indigo-50"
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
