import type { ReactNode } from "react";
import { Ornament } from "@/components/ui/ornament";
import { withLineBreaks } from "@/components/ui/section";
import { cn } from "@/lib/cn";

/*
 * Centred statement hero (kit pricing.md 2.1): a pale line ornament, a 2-line
 * display h1 (52px / 36px mobile, weight 425, -1px tracking) and an 18px grey
 * subtitle. No image and no CTA: the content right below carries the actions.
 * 160px top padding on desktop (it clears the 68px fixed header), 112px mobile.
 */

export interface HeroCenteredProps {
  title: string;
  lead?: ReactNode;
  /** Optional row under the lead. */
  children?: ReactNode;
  className?: string;
}

export function HeroCentered({ title, lead, children, className }: HeroCenteredProps) {
  return (
    <section className={cn("container flex flex-col items-center gap-6 pt-28 text-center md:pt-40", className)}>
      <Ornament className="h-7 text-[#d9dce6]" />
      <div className="flex flex-col items-center gap-3 md:gap-4">
        <h1 className="max-w-4xl text-balance font-display text-[36px] font-normal leading-[1.2] tracking-[-1px] text-tx md:text-[52px]">
          {withLineBreaks(title)}
        </h1>
        {lead ? (
          <p className="max-w-[700px] text-body leading-[1.55] text-tx-tertiary md:text-body-lg">{lead}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
