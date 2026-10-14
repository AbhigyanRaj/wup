import * as React from "react";
import { cn } from "@/lib/cn";

export interface StepperProps {
  /** Step labels, in order. */
  steps: ReadonlyArray<React.ReactNode>;
  /** Current step, 1-based. */
  current: number;
  /** Show the "Step 2 of 4" caption and current step label (default true). */
  showCaption?: boolean;
  className?: string;
}

/**
 * Segmented step indicator: one 4px segment per step (done and current in
 * blue-600, upcoming in #f0f0f0) plus a "Step n of N" caption.
 */
export function Stepper({ steps, current, showCaption = true, className }: StepperProps) {
  const total = steps.length;
  const n = Math.min(Math.max(current, 1), total);
  return (
    <div className={cn("flex w-full flex-col gap-2.5", className)}>
      {showCaption ? (
        <div className="flex items-baseline justify-between gap-3 text-[13px] leading-5">
          <span className="font-medium text-tx-secondary">{steps[n - 1]}</span>
          <span className="tabular-nums text-tx-tertiary">
            Step {n} of {total}
          </span>
        </div>
      ) : null}
      <ol className="flex w-full gap-1.5" aria-label={`Step ${n} of ${total}`}>
        {steps.map((label, i) => {
          const idx = i + 1;
          const state = idx < n ? "complete" : idx === n ? "current" : "upcoming";
          return (
            <li
              key={i}
              aria-current={state === "current" ? "step" : undefined}
              className="relative h-1 flex-1 overflow-hidden rounded-full bg-sf-tertiary"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full bg-blue-600 transition-[width] duration-500 ease-out",
                  state === "upcoming" ? "w-0" : "w-full",
                )}
              />
              <span className="sr-only">
                {label}
                {state === "complete" ? " (completed)" : state === "current" ? " (current)" : ""}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
