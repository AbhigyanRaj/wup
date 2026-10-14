"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef, PointerEvent, ReactNode, Ref } from "react";
import { cn } from "@/lib/cn";

/*
 * Kit pill buttons (.btn). All variants are pills with min-height 40px, a
 * press scale of .96 and Figtree 525 (the hero sizes use the display font).
 * Filled variants get the cursor-following glow: --gx / --gy are written to the
 * element's style on pointer move. No React state, so hovering never re-renders.
 */

export type ButtonVariant =
  | "ink"
  | "soft"
  | "hero-primary"
  | "hero-outline"
  | "outline"
  | "auth"
  | "auth-primary"
  | "ghost"
  | "danger-soft";

export type ButtonSize = "sm" | "md" | "lg";

const FILLED: ReadonlySet<ButtonVariant> = new Set(["ink", "hero-primary", "auth-primary"]);

interface ButtonOwnProps {
  /** Visual style. Default "ink". */
  variant?: ButtonVariant;
  /** sm = header (15px), md = default, lg = hero (52px, display font). Hero variants default to lg. */
  size?: ButtonSize;
  /** Show a trailing arrow that plays the kit's arrow-loop on hover. */
  arrow?: boolean;
  /** Stretch to the container width. */
  block?: boolean;
  /** Icon before the label (16px lucide icon recommended). */
  leadingIcon?: ReactNode;
  /** Icon after the label (ignored when `arrow` is set). */
  trailingIcon?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function buttonClassName({
  variant = "ink",
  size,
  block,
  className,
}: Pick<ButtonOwnProps, "variant" | "size" | "block" | "className">) {
  const resolvedSize = size ?? (variant === "hero-primary" || variant === "hero-outline" ? "lg" : "md");
  return cn(
    "btn",
    `btn--${variant}`,
    resolvedSize === "sm" && "btn--sm",
    resolvedSize === "lg" && "btn--hero",
    block && "btn--block",
    className,
  );
}

function trackGlow(e: PointerEvent<HTMLElement>) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--gx", `${e.clientX - r.left}px`);
  el.style.setProperty("--gy", `${e.clientY - r.top}px`);
}

export function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("btn__arrow", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function Inner({
  variant = "ink",
  arrow,
  leadingIcon,
  trailingIcon,
  children,
}: Pick<ButtonOwnProps, "variant" | "arrow" | "leadingIcon" | "trailingIcon" | "children">) {
  return (
    <>
      {FILLED.has(variant) ? <span className="btn__glow" aria-hidden="true" /> : null}
      <span>
        {leadingIcon}
        {children}
        {arrow ? <ArrowIcon /> : trailingIcon}
      </span>
    </>
  );
}

export type ButtonProps = ButtonOwnProps &
  Omit<ComponentPropsWithoutRef<"button">, keyof ButtonOwnProps> & {
    ref?: Ref<HTMLButtonElement>;
  };

export function Button({
  variant = "ink",
  size,
  arrow,
  block,
  leadingIcon,
  trailingIcon,
  className,
  children,
  type = "button",
  onPointerMove,
  ref,
  ...rest
}: ButtonProps) {
  const filled = FILLED.has(variant);
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClassName({ variant, size, block, className })}
      onPointerMove={(e) => {
        if (filled) trackGlow(e);
        onPointerMove?.(e);
      }}
      {...rest}
    >
      <Inner variant={variant} arrow={arrow} leadingIcon={leadingIcon} trailingIcon={trailingIcon}>
        {children}
      </Inner>
    </button>
  );
}

export type ButtonLinkProps = ButtonOwnProps &
  Omit<ComponentPropsWithoutRef<typeof Link>, keyof ButtonOwnProps> & {
    ref?: Ref<HTMLAnchorElement>;
  };

/** Same look as Button, rendered as a next/link. */
export function ButtonLink({
  variant = "ink",
  size,
  arrow,
  block,
  leadingIcon,
  trailingIcon,
  className,
  children,
  onPointerMove,
  ref,
  ...rest
}: ButtonLinkProps) {
  const filled = FILLED.has(variant);
  return (
    <Link
      ref={ref}
      className={buttonClassName({ variant, size, block, className })}
      onPointerMove={(e) => {
        if (filled) trackGlow(e);
        onPointerMove?.(e);
      }}
      {...rest}
    >
      <Inner variant={variant} arrow={arrow} leadingIcon={leadingIcon} trailingIcon={trailingIcon}>
        {children}
      </Inner>
    </Link>
  );
}
