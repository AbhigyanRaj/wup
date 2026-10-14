"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/cn";

/** App-level provider; groups tooltips so moving between triggers skips the delay. */
export function TooltipProvider({
  delayDuration = 300,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />;
}

export const TooltipRoot = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = React.forwardRef<
  React.ComponentRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(function TooltipContent({ className, sideOffset = 6, children, ...props }, ref) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn(
          "z-[130] max-w-[260px] rounded-lg bg-tx px-2.5 py-1.5 text-[12px] font-normal leading-4 text-white",
          "origin-(--radix-tooltip-content-transform-origin)",
          "transition-[opacity,scale] duration-150 ease-standard starting:scale-95 starting:opacity-0",
          className,
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow width={10} height={5} className="fill-tx" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
});

export interface TooltipProps {
  content: React.ReactNode;
  /** A single focusable element (button, link). */
  children: React.ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  delayDuration?: number;
  className?: string;
}

/**
 * Convenience tooltip. Includes its own provider so it works anywhere;
 * wrap the app in TooltipProvider as well for grouped skip-delay behaviour.
 */
export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  delayDuration = 300,
  className,
}: TooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipContent side={side} align={align} className={className}>
          {content}
        </TooltipContent>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
