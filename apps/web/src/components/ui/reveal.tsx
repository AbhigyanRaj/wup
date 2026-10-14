"use client";

import { useEffect, useRef, type ComponentPropsWithoutRef, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
 * Scroll reveal (kit motion.md). Fades content up 24px over 800ms with
 * --ease-reveal once 15% of it is visible. The hidden start state lives in
 * components.css under (min-width: 768px), so on mobile nothing is hidden and
 * nothing animates. With prefers-reduced-motion the content is revealed at once.
 *
 * variant="scale": scale(.96) + 20px, 1s (hero-adjacent showcase).
 * stagger: children rise 20px over 600ms, 120ms apart (data-reveal-stagger).
 */

export type RevealProps<T extends ElementType = "div"> = {
  as?: T;
  /** Default "fade". */
  variant?: "fade" | "scale";
  /** Reveal direct children one by one, 120ms apart. */
  stagger?: boolean;
  /** Per-child delay for `stagger`, in ms. Default 120. */
  staggerMs?: number;
  className?: string;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className" | "children">;

export function Reveal<T extends ElementType = "div">({
  as,
  variant = "fade",
  stagger = false,
  staggerMs = 120,
  className,
  children,
  ...rest
}: RevealProps<T>) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reveal = () => {
      if (stagger) {
        Array.from(el.children).forEach((child, i) => {
          const c = child as HTMLElement;
          c.style.transitionDelay = `${i * staggerMs}ms`;
          c.classList.add("is-revealed");
        });
      } else {
        el.classList.add("is-revealed");
      }
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof IntersectionObserver === "undefined") {
      reveal();
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            reveal();
            io.disconnect();
          }
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [stagger, staggerMs]);

  const Comp: ElementType = as ?? "div";
  const dataProps = stagger
    ? { "data-reveal-stagger": "" }
    : { "data-reveal": variant === "scale" ? "scale" : "" };

  return (
    <Comp ref={ref} className={cn(className)} {...dataProps} {...rest}>
      {children}
    </Comp>
  );
}
