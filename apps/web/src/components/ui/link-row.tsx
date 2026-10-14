import Link from "next/link";
import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
 * Kit link rows (.link-row): icon + label ... arrow, separated by hairlines.
 * On hover the arrow darkens and nudges 2px and the icon tints to `hoverColor`
 * (defaults to --icon-hover-indigo).
 */

export interface LinkRowProps extends Omit<ComponentPropsWithoutRef<typeof Link>, "children"> {
  label: ReactNode;
  /** 20px line icon (lucide). */
  icon?: ReactNode;
  /** Icon tint on hover, e.g. "var(--icon-hover-orange)" (sky) or "var(--icon-hover-green)". */
  hoverColor?: string;
}

export function LinkRow({ label, icon, hoverColor, className, style, ...rest }: LinkRowProps) {
  const rowStyle = hoverColor ? ({ ...style, "--hover": hoverColor } as CSSProperties) : style;
  return (
    <Link className={cn("link-row", className)} style={rowStyle} {...rest}>
      <span className="link-row__label">
        {icon}
        {label}
      </span>
      <svg
        className="link-row__arrow"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </Link>
  );
}

/** Wrapper for a list of LinkRows (.link-rows). */
export function LinkRows({ className, ...rest }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("link-rows", className)} {...rest} />;
}
