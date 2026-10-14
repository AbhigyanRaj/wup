import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
 * Card chrome shared by every answer renderer: white card, radius 16, 1px #f0f0f0,
 * 24px padding (16 on mobile), 15/525 title with an optional 13px caption, and
 * icon actions at the top right.
 */

export interface RendererShellProps {
  title?: ReactNode;
  caption?: ReactNode;
  /** Small label above the title ("Chart", "Diagram"). */
  eyebrow?: ReactNode;
  actions?: ReactNode;
  /** Controls placed under the header row on mobile and beside the actions on desktop. */
  controls?: ReactNode;
  children?: ReactNode;
  /** Let the body run edge to edge (tables). The header keeps its padding. */
  flush?: boolean;
  className?: string;
  bodyClassName?: string;
  labelId?: string;
}

export function RendererShell({
  title,
  caption,
  eyebrow,
  actions,
  controls,
  children,
  flush,
  className,
  bodyClassName,
  labelId,
}: RendererShellProps) {
  const hasHeader = Boolean(title || caption || actions || controls || eyebrow);
  return (
    <section
      aria-labelledby={title && labelId ? labelId : undefined}
      className={cn(
        "renderer-card w-full min-w-0 overflow-hidden rounded-card border border-st-secondary bg-sf-white text-tx",
        !flush && "p-4 sm:p-6",
        className,
      )}
    >
      {hasHeader ? (
        <header
          className={cn(
            "flex flex-wrap items-start justify-between gap-x-4 gap-y-3",
            flush ? "px-4 pt-4 pb-3 sm:px-6 sm:pt-5" : children ? "mb-5" : "",
          )}
        >
          <div className="min-w-0 flex-1 basis-56">
            {eyebrow ? (
              <p className="mb-1 text-[12px] font-medium uppercase leading-4 tracking-[0.08em] text-tx-tertiary">
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <h3 id={labelId} className="text-[15px] font-medium leading-[22px] tracking-[-0.005em] text-tx text-balance">
                {title}
              </h3>
            ) : null}
            {caption ? <p className="mt-0.5 text-[13px] leading-5 text-tx-tertiary">{caption}</p> : null}
          </div>
          {controls || actions ? (
            <div className="-mr-1.5 -mt-1 flex shrink-0 items-center gap-1.5">
              {controls}
              {actions ? <div className="flex items-center gap-0.5">{actions}</div> : null}
            </div>
          ) : null}
        </header>
      ) : null}
      {children ? <div className={cn("min-w-0", bodyClassName)}>{children}</div> : null}
    </section>
  );
}
