"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Command as Cmdk } from "cmdk";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { EASE_STANDARD, overlayClass, useReturnFocus } from "./dialog";

/*
  Command palette (cmd/ctrl + K) on cmdk, styled like the kit mega menu:
  white panel, hairline border, mono uppercase group labels, 6px-padded rows
  with an icon tile, #f5f5f5 selection, blurred dim backdrop.
  cmdk handles filtering, arrow keys, Enter and aria-activedescendant.
*/

export const Command = React.forwardRef<
  React.ComponentRef<typeof Cmdk>,
  React.ComponentPropsWithoutRef<typeof Cmdk>
>(function Command({ className, ...props }, ref) {
  return (
    <Cmdk
      ref={ref}
      className={cn("flex w-full flex-col overflow-hidden bg-sf-white text-tx", className)}
      {...props}
    />
  );
});

export interface CommandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible name for the dialog and listbox. */
  label?: string;
  children: React.ReactNode;
  /** Optional footer (keyboard hints are shown by default). */
  footer?: React.ReactNode;
  /** Pass through to cmdk (e.g. shouldFilter={false} for async search). */
  commandProps?: Omit<React.ComponentPropsWithoutRef<typeof Cmdk>, "children">;
}

export function CommandDialog({
  open,
  onOpenChange,
  label = "Command menu",
  children,
  footer,
  commandProps,
}: CommandDialogProps) {
  const reduce = useReducedMotion();
  const focusHandlers = useReturnFocus();
  const t = { duration: reduce ? 0 : 0.2, ease: EASE_STANDARD };
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
                transition={t}
              />
            </DialogPrimitive.Overlay>
            <div className="pointer-events-none fixed inset-0 z-[101] flex items-start justify-center px-3 pt-3 sm:px-6 sm:pt-[12vh]">
              <DialogPrimitive.Content
                asChild
                forceMount
                aria-describedby={undefined}
                {...focusHandlers}
              >
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={t}
                  className="pointer-events-auto w-full max-w-[640px] overflow-hidden rounded-2xl border border-st-secondary bg-sf-white shadow-[0_12px_40px_-8px_#0000001f] focus:outline-none"
                >
                  <DialogPrimitive.Title className="sr-only">{label}</DialogPrimitive.Title>
                  <Command label={label} loop {...commandProps}>
                    {children}
                    {footer ?? <CommandFooter />}
                  </Command>
                </motion.div>
              </DialogPrimitive.Content>
            </div>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

export const CommandInput = React.forwardRef<
  React.ComponentRef<typeof Cmdk.Input>,
  React.ComponentPropsWithoutRef<typeof Cmdk.Input>
>(function CommandInput({ className, placeholder = "Search or jump to...", ...props }, ref) {
  return (
    <div className="flex h-14 items-center gap-3 border-b border-st-secondary px-5">
      <Search className="size-[18px] shrink-0 text-tx-muted" strokeWidth={1.5} aria-hidden="true" />
      <Cmdk.Input
        ref={ref}
        placeholder={placeholder}
        className={cn(
          "h-full min-w-0 flex-1 bg-transparent text-[16px] text-tx outline-none placeholder:text-tx-muted",
          className,
        )}
        {...props}
      />
      <kbd className="hidden h-6 items-center rounded-md border border-st bg-sf-secondary px-1.5 font-mono text-[11px] text-tx-tertiary sm:inline-flex">
        esc
      </kbd>
    </div>
  );
});

export const CommandList = React.forwardRef<
  React.ComponentRef<typeof Cmdk.List>,
  React.ComponentPropsWithoutRef<typeof Cmdk.List>
>(function CommandList({ className, ...props }, ref) {
  return (
    <Cmdk.List
      ref={ref}
      className={cn(
        "max-h-[min(440px,60dvh)] scroll-py-2 overflow-y-auto overscroll-contain p-2",
        className,
      )}
      {...props}
    />
  );
});

export const CommandEmpty = React.forwardRef<
  React.ComponentRef<typeof Cmdk.Empty>,
  React.ComponentPropsWithoutRef<typeof Cmdk.Empty>
>(function CommandEmpty({ className, children = "No results found.", ...props }, ref) {
  return (
    <Cmdk.Empty
      ref={ref}
      className={cn("px-4 py-10 text-center text-[14px] text-tx-tertiary", className)}
      {...props}
    >
      {children}
    </Cmdk.Empty>
  );
});

export const CommandGroup = React.forwardRef<
  React.ComponentRef<typeof Cmdk.Group>,
  React.ComponentPropsWithoutRef<typeof Cmdk.Group>
>(function CommandGroup({ className, ...props }, ref) {
  return (
    <Cmdk.Group
      ref={ref}
      className={cn(
        "[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-2 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:leading-[18px] [&_[cmdk-group-heading]]:text-tx-tertiary",
        className,
      )}
      {...props}
    />
  );
});

export const CommandSeparator = React.forwardRef<
  React.ComponentRef<typeof Cmdk.Separator>,
  React.ComponentPropsWithoutRef<typeof Cmdk.Separator>
>(function CommandSeparator({ className, ...props }, ref) {
  return (
    <Cmdk.Separator
      ref={ref}
      className={cn("-mx-2 my-2 h-px bg-st-secondary", className)}
      {...props}
    />
  );
});

export interface CommandItemProps extends React.ComponentPropsWithoutRef<typeof Cmdk.Item> {
  /** Icon rendered in the kit mega-menu tile. */
  icon?: React.ReactNode;
  description?: React.ReactNode;
  shortcut?: React.ReactNode;
}

export const CommandItem = React.forwardRef<
  React.ComponentRef<typeof Cmdk.Item>,
  CommandItemProps
>(function CommandItem({ className, icon, description, shortcut, children, ...props }, ref) {
  return (
    <Cmdk.Item
      ref={ref}
      className={cn(
        "flex cursor-pointer select-none items-center gap-3 rounded-xl p-1.5 pr-3 transition-colors duration-150 ease-out",
        "data-[selected=true]:bg-sf-secondary data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
        className,
      )}
      {...props}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sf-white text-tx-secondary shadow-[0_0_0_1px_#f0f0f0,0_1px_3px_#00000014] [&_svg]:size-[18px] [&_svg]:stroke-[1.5]"
        >
          {icon}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] leading-[1.3] text-tx">{children}</span>
        {description ? (
          <span className="truncate text-[13px] leading-[1.4] text-tx-tertiary">{description}</span>
        ) : null}
      </span>
      {shortcut ? (
        <span className="shrink-0 font-mono text-[12px] text-tx-muted">{shortcut}</span>
      ) : null}
    </Cmdk.Item>
  );
});

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-st bg-sf-white px-1 font-mono text-[11px] text-tx-tertiary">
      {children}
    </kbd>
  );
}

export function CommandFooter({ children }: { children?: React.ReactNode }) {
  return (
    <div className="hidden items-center justify-between gap-4 border-t border-st-secondary bg-sf-secondary/50 px-4 py-2.5 text-[12px] text-tx-tertiary sm:flex">
      {children ?? (
        <>
          <span className="flex items-center gap-1.5">
            <Key>&uarr;</Key>
            <Key>&darr;</Key>
            <span className="ml-0.5">to navigate</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Key>&#8629;</Key>
            <span className="ml-0.5">to select</span>
          </span>
        </>
      )}
    </div>
  );
}

/** Toggle the palette with cmd+K / ctrl+K. */
export function useCommandShortcut(toggle: () => void, key = "k") {
  const ref = React.useRef(toggle);
  React.useEffect(() => {
    ref.current = toggle;
  });
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === key) {
        e.preventDefault();
        ref.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [key]);
}
