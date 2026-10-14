import type { ComponentPropsWithoutRef, Ref } from "react";
import { cn } from "@/lib/cn";

/*
 * Kit filter chip (.chip): transparent pill, soft grey on hover, white with a
 * hairline when active. Rendered as a toggle button (aria-pressed).
 * No hooks, so pass onClick from a client component.
 */

export interface ChipProps extends ComponentPropsWithoutRef<"button"> {
  /** Selected state; sets aria-pressed. */
  active?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function Chip({ active = false, className, type = "button", ref, ...rest }: ChipProps) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={active}
      className={cn("chip", active && "is-active", className)}
      {...rest}
    />
  );
}

/** Centred, wrapping row of chips (.chips). */
export function Chips({ className, ...rest }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("chips", className)} {...rest} />;
}
