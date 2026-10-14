import type { ComponentPropsWithoutRef, CSSProperties } from "react";
import { cn } from "@/lib/cn";

/*
 * Brand. Text-only lowercase "wuup", Figtree 700, letter-spacing -0.035em,
 * black (white on dark). No effects on the wordmark itself.
 * Kept deliberately simple so it can be swapped for the outlined SVG files
 * from the images agent (public/brand) without changing call sites.
 */

export type WordmarkSize = "header" | "footer" | number;

export interface WordmarkProps extends Omit<ComponentPropsWithoutRef<"span">, "children"> {
  /** "header" = 24px (default), "footer" = 40px, or a px number. */
  size?: WordmarkSize;
  /** White, for dark surfaces. */
  inverse?: boolean;
}

export function Wordmark({ size = "header", inverse = false, className, style, ...rest }: WordmarkProps) {
  const sizeStyle: CSSProperties | undefined = typeof size === "number" ? { fontSize: size } : undefined;
  return (
    <span
      className={cn("wordmark", size === "footer" && "wordmark--footer", inverse && "wordmark--inverse", className)}
      style={{ ...sizeStyle, ...style }}
      {...rest}
    >
      wuup
    </span>
  );
}

export interface MarkProps extends Omit<ComponentPropsWithoutRef<"span">, "children"> {
  /** Edge length in px. Default 32. */
  size?: number;
  /** "ink" = white w on slate (default), "light" = black w on white with hairline, "plain" = no frame fill. */
  tone?: "ink" | "light" | "plain";
  /** Accessible name. Without it the mark is decorative. */
  label?: string;
}

/** Square brand mark: a bold lowercase "w" in a 1:1 rounded frame. */
export function Mark({ size = 32, tone = "ink", label, className, style, ...rest }: MarkProps) {
  return (
    <span
      className={cn("mark", tone === "light" && "mark--light", tone === "plain" && "mark--plain", className)}
      style={{ ["--mark-size" as string]: `${size}px`, ...style } as CSSProperties}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      {...rest}
    >
      w
    </span>
  );
}
