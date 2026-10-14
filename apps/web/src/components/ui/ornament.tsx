import type { SVGProps } from "react";
import { cn } from "@/lib/cn";

/*
 * The kit's symmetric line ornament (assets/ornament.svg), inlined with
 * currentColor. Sits above the hero badge (white with a periwinkle glow via
 * .hero__ornament), in the CTA band and in empty states. 208 x 32 viewBox,
 * 32px tall by default; size it with a height class (e.g. h-6) and the width follows.
 */

export interface OrnamentProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  /** Accessible title. Without it the ornament is decorative (aria-hidden). */
  title?: string;
}

export function Ornament({ title, className, ...rest }: OrnamentProps) {
  return (
    <svg
      viewBox="0 0 208 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      height={32}
      className={cn("w-auto", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      {...rest}
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
