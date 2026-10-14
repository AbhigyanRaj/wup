import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Content for screen readers only (Tailwind sr-only). Use for icon labels, skip links (with focus styles), etc. */
export type VisuallyHiddenProps<T extends ElementType = "span"> = {
  as?: T;
  className?: string;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className" | "children">;

export function VisuallyHidden<T extends ElementType = "span">({ as, className, ...rest }: VisuallyHiddenProps<T>) {
  const Comp: ElementType = as ?? "span";
  return <Comp className={cn("sr-only", className)} {...rest} />;
}
