import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Kit content container: 88% wide on mobile, 83.333% from 768px, max 1400px
 * from 1536px (1200px of content at a 1440 viewport).
 */
export type ContainerProps<T extends ElementType = "div"> = {
  as?: T;
  className?: string;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className" | "children">;

export function Container<T extends ElementType = "div">({ as, className, children, ...rest }: ContainerProps<T>) {
  const Comp: ElementType = as ?? "div";
  return (
    <Comp className={cn("container", className)} {...rest}>
      {children}
    </Comp>
  );
}
