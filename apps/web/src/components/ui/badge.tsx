import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
 * Kit compliance / status chip (.badge): 14px semibold, radius 12px, tinted
 * fill + hairline border + inner bottom glow, wiggles on hover.
 */

export type BadgeTone = "indigo" | "green" | "sky" | "pink" | "yellow" | "red";

export interface BadgeProps extends ComponentPropsWithoutRef<"span"> {
  /** Default "indigo". */
  tone?: BadgeTone;
  /** Optional leading icon (14-16px). */
  icon?: ReactNode;
}

export function Badge({ tone = "indigo", icon, className, children, ...rest }: BadgeProps) {
  return (
    <span className={cn("badge", `badge--${tone}`, className)} {...rest}>
      {icon}
      {children}
    </span>
  );
}
