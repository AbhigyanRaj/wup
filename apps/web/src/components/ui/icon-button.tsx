import type { ComponentPropsWithoutRef, ReactNode, Ref } from "react";
import { cn } from "@/lib/cn";

/*
 * Round icon-only pill button. `aria-label` is required by the type, because an
 * icon alone has no accessible name. No hooks, so it works in server and client trees.
 */

export type IconButtonVariant = "ghost" | "soft" | "outline" | "ink";
export type IconButtonSize = "sm" | "md" | "lg";

export type IconButtonProps = Omit<ComponentPropsWithoutRef<"button">, "aria-label" | "children"> & {
  /** Accessible name. Required. */
  "aria-label": string;
  /** The icon (lucide icons are sized by CSS: 16 / 18 / 20px). */
  children: ReactNode;
  /** Default "ghost". */
  variant?: IconButtonVariant;
  /** sm = 32px (dense toolbars only), md = 40px (default), lg = 48px. */
  size?: IconButtonSize;
  ref?: Ref<HTMLButtonElement>;
};

export function IconButton({
  variant = "ghost",
  size = "md",
  className,
  type = "button",
  children,
  ref,
  ...rest
}: IconButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "icon-btn",
        `icon-btn--${variant}`,
        size === "sm" && "icon-btn--sm",
        size === "lg" && "icon-btn--lg",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
