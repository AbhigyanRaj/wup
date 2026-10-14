import * as React from "react";
import { cn } from "@/lib/cn";

/** Kit ornament (assets/ornament.svg), drawn in currentColor. */
function EmptyOrnament({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 208 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M4 30h200" />
      <path d="M104 4c-6 8-6 16 0 24c6-8 6-16 0-24Z" />
      <path d="M92 26c-10-2-20-8-26-16c8 2 18 6 26 16Z" />
      <path d="M116 26c10-2 20-8 26-16c-8 2-18 6-26 16Z" />
      <path d="M60 26c-12 0-26-4-36-10c12 0 26 4 36 10Z" />
      <path d="M148 26c12 0 26-4 36-10c-12 0-26 4-36 10Z" />
      <circle cx="104" cy="16" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export interface EmptyStateProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Action slot, usually a soft pill button. */
  action?: React.ReactNode;
  /** Replace the ornament (e.g. with an icon tile). */
  visual?: React.ReactNode;
  /** Heading level for the title (default h3). */
  as?: "h2" | "h3" | "h4";
  className?: string;
}

/** Centred ornament, 20px title, 16px #666 copy, optional action. */
export function EmptyState({
  title,
  description,
  action,
  visual,
  as: Heading = "h3",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "mx-auto flex max-w-md flex-col items-center px-6 py-12 text-center md:py-16",
        className,
      )}
    >
      {visual ?? <EmptyOrnament className="h-6 w-auto text-indigo-200 md:h-8" />}
      <Heading className="mt-6 text-[20px] font-medium leading-[1.3] tracking-[-0.015em] text-tx">
        {title}
      </Heading>
      {description ? (
        <p className="mt-2 text-[16px] leading-[1.6] text-tx-tertiary">{description}</p>
      ) : null}
      {action ? <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}
