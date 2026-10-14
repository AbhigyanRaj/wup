import * as React from "react";
import { cn } from "@/lib/cn";

export type ProgressTone = "blue" | "indigo" | "green" | "red";

const toneClass: Record<ProgressTone, string> = {
  blue: "bg-blue-600",
  indigo: "bg-indigo-600",
  green: "bg-green-600",
  red: "bg-red-400",
};

const INDETERMINATE_CSS =
  "@keyframes wuup-progress-indeterminate{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}";

export interface ProgressProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** 0..max. Pass null for an indeterminate bar. */
  value: number | null;
  max?: number;
  tone?: ProgressTone;
  /** Visible label above the bar (also used as the accessible name). */
  label?: React.ReactNode;
  /** Show the percentage on the right of the label row. */
  showValue?: boolean;
  /** Accessible name when no visible label is rendered. */
  "aria-label"?: string;
}

/** 4px progress bar (blue-600 by default). */
export function Progress({
  value,
  max = 100,
  tone = "blue",
  label,
  showValue,
  className,
  ...props
}: ProgressProps) {
  const labelId = React.useId();
  const indeterminate = value === null;
  const pct = indeterminate ? 0 : Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={cn("flex w-full flex-col gap-2", className)}>
      {indeterminate ? (
        <style href="wuup-progress-indeterminate" precedence="default">
          {INDETERMINATE_CSS}
        </style>
      ) : null}
      {label || showValue ? (
        <div className="flex items-baseline justify-between gap-3 text-[13px] leading-5">
          {label ? (
            <span id={labelId} className="text-tx-secondary">
              {label}
            </span>
          ) : (
            <span />
          )}
          {showValue && !indeterminate ? (
            <span className="tabular-nums text-tx-tertiary">{Math.round(pct)}%</span>
          ) : null}
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={indeterminate ? undefined : value}
        aria-labelledby={label ? labelId : undefined}
        className="relative h-1 w-full overflow-hidden rounded-full bg-sf-tertiary"
        {...props}
      >
        <div
          className={cn(
            "h-full rounded-full",
            toneClass[tone],
            indeterminate
              ? "w-2/5 animate-[wuup-progress-indeterminate_1.4s_cubic-bezier(0.4,0,0.2,1)_infinite]"
              : "transition-[width] duration-300 ease-standard",
          )}
          style={indeterminate ? undefined : { width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
