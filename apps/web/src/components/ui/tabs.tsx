"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400";

/* --------------------------------------------------------------------------
   Tabs: kit showcase tab bar as pills.
   Inactive #f0f0f0 / #666, active white / indigo-800 + shadow-tab-active.
   Arrow keys, Home/End and roving focus come from Radix.
   -------------------------------------------------------------------------- */

export const Tabs = TabsPrimitive.Root;

export interface TabsListProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  /** Stretch triggers to equal widths (showcase bar). */
  fullWidth?: boolean;
}

export const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  TabsListProps
>(function TabsList({ className, fullWidth, ...props }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "-mx-1 flex max-w-full gap-2 overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        fullWidth ? "w-[calc(100%+8px)]" : "w-fit",
        fullWidth && "[&>*]:flex-1",
        className,
      )}
      {...props}
    />
  );
});

export const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & { icon?: React.ReactNode }
>(function TabsTrigger({ className, icon, children, ...props }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "inline-flex min-h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 py-2 text-[15px] font-medium leading-[1.35]",
        "bg-sf-tertiary text-tx-tertiary transition-[color,background-color,box-shadow] duration-150 ease-out hover:text-tx",
        "data-[state=active]:bg-sf-white data-[state=active]:text-indigo-800 data-[state=active]:shadow-[inset_0_0_6px_rgba(0,0,0,0.08),0_0_0_1px_#e6e6e6]",
        "disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:size-4 [&_svg]:stroke-[1.5]",
        focusRing,
        className,
      )}
      {...props}
    >
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {children}
    </TabsPrimitive.Trigger>
  );
});

export const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn(
        "mt-6 rounded-lg transition-[opacity,translate] duration-300 ease-standard starting:translate-y-2.5 starting:opacity-0",
        focusRing,
        className,
      )}
      {...props}
    />
  );
});

/* --------------------------------------------------------------------------
   SegmentedControl: #f5f5f5 track, 4px padding, sliding white pill.
   Radio-group semantics with roving focus (arrow keys move and select).
   -------------------------------------------------------------------------- */

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
  options: ReadonlyArray<SegmentedOption<T> | T>;
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  fullWidth?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  size = "md",
  fullWidth,
  className,
  ...aria
}: SegmentedControlProps<T>) {
  const id = React.useId();
  const reduce = useReducedMotion();
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const items: SegmentedOption<T>[] = options.map((o) =>
    typeof o === "string" ? { value: o as T, label: o } : o,
  );
  const enabled = items.filter((o) => !o.disabled);

  function move(delta: number) {
    const i = enabled.findIndex((o) => o.value === value);
    const next = enabled[(i + delta + enabled.length) % enabled.length];
    if (!next) return;
    onChange(next.value);
    const idx = items.findIndex((o) => o.value === next.value);
    refs.current[idx]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      const target = e.key === "Home" ? enabled[0] : enabled[enabled.length - 1];
      if (target) {
        onChange(target.value);
        refs.current[items.findIndex((o) => o.value === target.value)]?.focus();
      }
    }
  }

  return (
    <div
      role="radiogroup"
      {...aria}
      onKeyDown={onKeyDown}
      className={cn(
        "relative inline-flex max-w-full gap-0 rounded-full bg-sf-secondary p-1",
        fullWidth && "flex w-full",
        className,
      )}
    >
      {items.map((opt, i) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={opt.disabled}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-medium transition-colors duration-150 ease-out",
              size === "sm" ? "h-8 px-3 text-[13px]" : "h-9 px-4 text-[14px]",
              selected ? "text-tx" : "text-tx-tertiary hover:text-tx",
              "disabled:pointer-events-none disabled:opacity-50",
              "[&_svg]:size-4 [&_svg]:stroke-[1.5]",
              fullWidth && "flex-1",
              focusRing,
            )}
          >
            {selected ? (
              <motion.span
                layoutId={`seg-pill-${id}`}
                aria-hidden="true"
                className="absolute inset-0 rounded-full bg-sf-white shadow-[0_1px_3px_#00000014]"
                transition={{ duration: reduce ? 0 : 0.3, ease: [0.2, 0, 0, 1] }}
              />
            ) : null}
            <span className="relative z-[1] inline-flex items-center gap-1.5">
              {opt.icon ? <span aria-hidden="true">{opt.icon}</span> : null}
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
