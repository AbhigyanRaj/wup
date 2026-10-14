import type { ReactNode } from "react";
import { Ornament } from "@/components/ui/ornament";
import { withLineBreaks } from "@/components/ui/section";
import { cn } from "@/lib/cn";

/*
 * Compact sunrise hero for inner pages (kit product page §3.1 on the home
 * sunrise). The blue two-tone gradient (.hero__gradient) bleeds through the
 * header, then the centred stack: ornament, badge, display h1 (52px / 40px
 * mobile, the kit's inner-page size), lead and actions. No 100vh: the next
 * section starts right under it.
 */

export interface HeroCompactProps {
  /** Small badge text between two gradient rules. */
  eyebrow?: ReactNode;
  /** The page h1. "\n" forces a line break. */
  title: string;
  lead?: ReactNode;
  /** Buttons row. */
  actions?: ReactNode;
  /** Anything under the actions (chips, a note). */
  children?: ReactNode;
  className?: string;
}

export function HeroCompact({ eyebrow, title, lead, actions, children, className }: HeroCompactProps) {
  return (
    <section className={cn("hero hero--compact", className)}>
      <div className="hero__fade" aria-hidden="true" />
      <div className="hero__gradient" aria-hidden="true" />
      <div className="container hero__content">
        <div className="hero__glow" aria-hidden="true" />
        <Ornament className="hero__ornament" />
        {eyebrow ? (
          <div className="hero-badge">
            <div className="hero-badge__rule" />
            <p className="hero-badge__text">{eyebrow}</p>
            <div className="hero-badge__rule" />
          </div>
        ) : null}
        <h1 className="h-hero text-[40px] leading-[1.1] md:text-[56px]">{withLineBreaks(title)}</h1>
        {lead ? <p className="lead mx-auto max-w-[700px] text-balance">{lead}</p> : null}
        {actions ? <div className="hero__actions">{actions}</div> : null}
        {children}
      </div>
    </section>
  );
}
