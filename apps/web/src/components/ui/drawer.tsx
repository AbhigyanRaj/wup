"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { EASE_STANDARD, overlayClass, useReturnFocus } from "./dialog";

export type DrawerSide = "left" | "right" | "bottom";

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  side?: DrawerSide;
  /** Width for left/right drawers (px number or any CSS length). Ignored for bottom. */
  width?: number | string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400";

const sideClass: Record<DrawerSide, string> = {
  right:
    "right-0 top-0 h-dvh w-[var(--drawer-w)] max-w-[calc(100vw-32px)] border-l rounded-l-2xl",
  left: "left-0 top-0 h-dvh w-[var(--drawer-w)] max-w-[calc(100vw-32px)] border-r rounded-r-2xl",
  bottom:
    "inset-x-0 bottom-0 max-h-[85dvh] w-full border-t rounded-t-3xl pb-[env(safe-area-inset-bottom)]",
};

const offscreen: Record<DrawerSide, { x?: string; y?: string }> = {
  right: { x: "100%" },
  left: { x: "-100%" },
  bottom: { y: "100%" },
};

export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  side = "right",
  width = 420,
  children,
  footer,
  className,
}: DrawerProps) {
  const reduce = useReducedMotion();
  const focusHandlers = useReturnFocus();
  const w = typeof width === "number" ? `${width}px` : width;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open ? (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className={overlayClass}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.3, ease: EASE_STANDARD }}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content
              asChild
              forceMount
              {...focusHandlers}
              {...(description ? {} : { "aria-describedby": undefined })}
            >
              <motion.div
                initial={offscreen[side]}
                animate={{ x: 0, y: 0 }}
                exit={offscreen[side]}
                transition={{ duration: reduce ? 0 : 0.35, ease: EASE_STANDARD }}
                style={{ "--drawer-w": w } as React.CSSProperties}
                className={cn(
                  "fixed z-[101] flex flex-col border-st-secondary bg-sf-white text-tx shadow-[0_12px_40px_-8px_#0000001f] focus:outline-none",
                  sideClass[side],
                  className,
                )}
              >
                {side === "bottom" ? (
                  <span
                    aria-hidden="true"
                    className="mx-auto mt-2.5 block h-1 w-9 shrink-0 rounded-full bg-st"
                  />
                ) : null}
                <div
                  className={cn(
                    "flex shrink-0 items-start gap-4 border-b border-st-secondary px-6 pb-4",
                    side === "bottom" ? "pt-3" : "pt-5",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <DialogPrimitive.Title className="text-[20px] font-medium leading-[1.3] tracking-[-0.015em] text-tx">
                      {title}
                    </DialogPrimitive.Title>
                    {description ? (
                      <DialogPrimitive.Description className="mt-1 text-[14px] leading-[1.55] text-tx-tertiary">
                        {description}
                      </DialogPrimitive.Description>
                    ) : null}
                  </div>
                  <DialogPrimitive.Close
                    aria-label="Close"
                    className={cn(
                      "-mr-2 -mt-1 inline-flex size-10 shrink-0 items-center justify-center rounded-full text-tx-tertiary transition-colors duration-200 ease-standard hover:bg-sf-secondary hover:text-tx",
                      focusRing,
                    )}
                  >
                    <X className="size-[18px]" strokeWidth={1.5} aria-hidden="true" />
                  </DialogPrimitive.Close>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 text-[15px] leading-[1.6] text-tx-secondary">
                  {children}
                </div>
                {footer ? (
                  <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-st-secondary px-6 py-4 sm:flex-row sm:justify-end">
                    {footer}
                  </div>
                ) : null}
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

export const DrawerClose = DialogPrimitive.Close;
