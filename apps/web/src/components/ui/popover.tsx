"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/cn";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;

/** White card, radius 16, hairline border, kit card shadow, 16px padding. */
export const PopoverContent = React.forwardRef<
  React.ComponentRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(function PopoverContent({ className, sideOffset = 8, align = "center", ...props }, ref) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        align={align}
        collisionPadding={12}
        className={cn(
          "z-[120] w-72 max-w-[calc(100vw-24px)] rounded-2xl border border-st-secondary bg-sf-white p-4 text-[14px] leading-[1.55] text-tx-secondary shadow-card",
          "origin-(--radix-popover-content-transform-origin)",
          "transition-[opacity,scale] duration-150 ease-standard starting:scale-[0.97] starting:opacity-0",
          "focus:outline-none",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
});
