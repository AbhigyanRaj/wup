import * as React from "react";
import { cn } from "@/lib/cn";

/* React 19 hoists and de-duplicates this <style> by href, so keyframes ship once. */
const SHIMMER_CSS =
  "@keyframes wuup-shimmer{from{transform:translateX(-100%)}to{transform:translateX(100%)}}";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Shape preset; size it with className (h-*, w-*). */
  shape?: "line" | "block" | "circle" | "pill";
}

const shapeClass = {
  line: "h-4 rounded-md",
  block: "rounded-2xl",
  circle: "rounded-full",
  pill: "rounded-full",
} as const;

/**
 * Loading placeholder on #f5f5f5 with a soft white shimmer.
 * The shimmer is removed under prefers-reduced-motion (static block).
 */
export function Skeleton({ shape = "line", className, ...props }: SkeletonProps) {
  return (
    <>
      <style href="wuup-skeleton-shimmer" precedence="default">
        {SHIMMER_CSS}
      </style>
      <div
        aria-hidden="true"
        className={cn(
          "relative overflow-hidden bg-sf-secondary",
          "after:absolute after:inset-0 after:bg-linear-to-r after:from-transparent after:via-white/80 after:to-transparent",
          "after:animate-[wuup-shimmer_1.6s_cubic-bezier(0.4,0,0.2,1)_infinite] motion-reduce:after:hidden",
          shapeClass[shape],
          className,
        )}
        {...props}
      />
    </>
  );
}

/** Several text lines; the last one is shorter. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2.5", className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={i === lines - 1 && lines > 1 ? "w-3/5" : "w-full"} />
      ))}
    </div>
  );
}
