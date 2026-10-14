import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

/*
 * Small status pill for tables and lists (.pill): 13px, fully rounded.
 * Tones follow DESIGN.md section 11: success green, warning yellow, error red,
 * info / selected indigo.
 */

export type PillTone = "success" | "warning" | "error" | "info" | "blue" | "neutral";

export interface PillProps extends ComponentPropsWithoutRef<"span"> {
  /** Default "success". */
  tone?: PillTone;
  /** Leading status dot in the text colour. */
  dot?: boolean;
}

export function Pill({ tone = "success", dot = false, className, children, ...rest }: PillProps) {
  return (
    <span className={cn("pill", `pill--${tone}`, className)} {...rest}>
      {dot ? <span className="pill__dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
