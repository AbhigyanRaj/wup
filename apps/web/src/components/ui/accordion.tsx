"use client";

import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/*
  Kit FAQ accordion (pricing.md 2.5) plus a compact in-app variant that follows
  the rate-table accordion (pricing.md 2.4).

  SEO: every answer is rendered in the server HTML. Content uses Radix
  `forceMount`, so it is never unmounted or given `hidden`; collapse is done with
  a CSS grid-rows 0fr/1fr transition and `visibility: hidden` (which also removes
  closed answers from the accessibility tree and tab order).
*/

export type AccordionVariant = "faq" | "compact";

const VariantContext = React.createContext<AccordionVariant>("faq");

type RootProps = React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Root>;

export type AccordionProps = RootProps & { variant?: AccordionVariant };

export const Accordion = React.forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Root>,
  AccordionProps
>(function Accordion({ variant = "faq", className, ...props }, ref) {
  return (
    <VariantContext.Provider value={variant}>
      <AccordionPrimitive.Root
        ref={ref}
        className={cn(
          variant === "faq"
            ? "flex w-full flex-col gap-0 md:gap-2"
            : "w-full overflow-hidden rounded-2xl border border-st-secondary bg-sf-white md:rounded-[20px]",
          className,
        )}
        {...(props as RootProps)}
      />
    </VariantContext.Provider>
  );
});

export const AccordionItem = React.forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(function AccordionItem({ className, ...props }, ref) {
  const variant = React.useContext(VariantContext);
  return (
    <AccordionPrimitive.Item
      ref={ref}
      className={cn(
        "group/acc-item",
        variant === "faq"
          ? "border-b border-st-secondary px-2 pb-4 md:overflow-hidden md:rounded-2xl md:border-b-0 md:bg-bg/50 md:px-0 md:pb-0 md:backdrop-blur-sm"
          : "border-b border-st-secondary last:border-b-0",
        className,
      )}
      {...props}
    />
  );
});

export interface AccordionTriggerProps
  extends React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger> {
  /** Leading 20px line icon (compact variant). */
  icon?: React.ReactNode;
  /** Second line under the title (compact variant). */
  subtitle?: React.ReactNode;
  /** Heading level wrapping the trigger. Defaults to h3. */
  as?: "h2" | "h3" | "h4";
}

export const AccordionTrigger = React.forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Trigger>,
  AccordionTriggerProps
>(function AccordionTrigger({ className, children, icon, subtitle, as = "h3", ...props }, ref) {
  const variant = React.useContext(VariantContext);
  const Heading = as;

  if (variant === "compact") {
    return (
      <AccordionPrimitive.Header asChild>
        <Heading className="m-0">
          <AccordionPrimitive.Trigger
            ref={ref}
            className={cn(
              "group/acc-trigger flex min-h-16 w-full items-center gap-4 px-6 py-3.5 text-left md:min-h-20 md:px-8 md:py-4",
              "transition-colors duration-200 ease-standard hover:bg-sf-secondary active:bg-sf-tertiary",
              "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-400",
              className,
            )}
            {...props}
          >
            {icon ? (
              <span
                aria-hidden="true"
                className="flex size-5 shrink-0 items-center justify-center text-tx transition-colors duration-200 group-data-[state=open]/acc-trigger:text-indigo-800 [&_svg]:size-5 [&_svg]:stroke-[1.5]"
              >
                {icon}
              </span>
            ) : null}
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[18px] font-medium leading-[1.4] tracking-[-0.02em] text-tx transition-colors duration-200 group-data-[state=open]/acc-trigger:text-indigo-800 md:text-[20px]">
                {children}
              </span>
              {subtitle ? (
                <span className="mt-0.5 text-[14px] leading-[1.5] text-tx-secondary">
                  {subtitle}
                </span>
              ) : null}
            </span>
            <ChevronDown
              aria-hidden="true"
              strokeWidth={1.5}
              className="size-4 shrink-0 text-tx-secondary transition-[rotate,color] duration-300 ease-standard group-data-[state=open]/acc-trigger:rotate-180 group-data-[state=open]/acc-trigger:text-indigo-800"
            />
          </AccordionPrimitive.Trigger>
        </Heading>
      </AccordionPrimitive.Header>
    );
  }

  return (
    <AccordionPrimitive.Header asChild>
      <Heading className="m-0">
        <AccordionPrimitive.Trigger
          ref={ref}
          className={cn(
            "group/acc-trigger flex min-h-11 w-full items-center justify-between gap-6 py-3 text-left text-[15px] font-normal leading-[1.625] text-tx md:rounded-2xl md:px-6 md:py-5 md:text-[18px]",
            "transition-colors duration-300 ease-standard md:hover:bg-black/5",
            "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-400",
            className,
          )}
          {...props}
        >
          <span className="min-w-0">{children}</span>
          <ChevronDown
            aria-hidden="true"
            strokeWidth={1.5}
            className="size-4 shrink-0 text-tx-secondary transition-[rotate,color] duration-300 ease-standard group-hover/acc-trigger:text-blue-600 group-data-[state=open]/acc-trigger:rotate-180 group-data-[state=open]/acc-trigger:text-blue-600"
          />
        </AccordionPrimitive.Trigger>
      </Heading>
    </AccordionPrimitive.Header>
  );
});

export const AccordionContent = React.forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Content>,
  Omit<React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>, "forceMount">
>(function AccordionContent({ className, children, ...props }, ref) {
  const variant = React.useContext(VariantContext);
  const faq = variant === "faq";
  return (
    <AccordionPrimitive.Content ref={ref} forceMount className="group/acc-content" {...props}>
      <div
        className={cn(
          "invisible grid grid-rows-[0fr] opacity-0",
          "group-data-[state=open]/acc-content:visible group-data-[state=open]/acc-content:grid-rows-[1fr] group-data-[state=open]/acc-content:opacity-100",
          faq
            ? "transition-[grid-template-rows,opacity,visibility] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            : "transition-[grid-template-rows,opacity,visibility] duration-[240ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={cn(
              faq
                ? "pb-1 pt-1 text-[14px] leading-[1.6] text-tx-secondary md:bg-sf-secondary md:px-6 md:py-5 md:text-[16px] [&_a]:text-tx [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-tx-tertiary"
                : "border-t border-st-secondary bg-sf-secondary/40 px-6 py-4 text-[14px] leading-[1.6] text-tx-tertiary md:px-8 md:text-[15px]",
              className,
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </AccordionPrimitive.Content>
  );
});

/* --------------------------------------------------------------------------
   Data-driven convenience wrappers
   -------------------------------------------------------------------------- */

export interface AccordionEntry {
  id: string;
  title: React.ReactNode;
  content: React.ReactNode;
  icon?: React.ReactNode;
  subtitle?: React.ReactNode;
}

interface EntriesProps {
  items: AccordionEntry[];
  /** Open item ids on first render. */
  defaultOpen?: string[];
  /** Allow several items open at once (default false). */
  multiple?: boolean;
  headingLevel?: "h2" | "h3" | "h4";
  className?: string;
}

function Entries({
  items,
  defaultOpen,
  multiple,
  headingLevel,
  className,
  variant,
}: EntriesProps & { variant: AccordionVariant }) {
  const body = items.map((item) => (
    <AccordionItem key={item.id} value={item.id}>
      <AccordionTrigger as={headingLevel} icon={item.icon} subtitle={item.subtitle}>
        {item.title}
      </AccordionTrigger>
      <AccordionContent>{item.content}</AccordionContent>
    </AccordionItem>
  ));
  return multiple ? (
    <Accordion variant={variant} type="multiple" defaultValue={defaultOpen} className={className}>
      {body}
    </Accordion>
  ) : (
    <Accordion
      variant={variant}
      type="single"
      collapsible
      defaultValue={defaultOpen?.[0]}
      className={className}
    >
      {body}
    </Accordion>
  );
}

/** Kit FAQ: soft borderless rows, 18px questions, max-width 896px. */
export function FaqAccordion({ className, ...props }: EntriesProps) {
  return <Entries variant="faq" className={cn("mx-auto max-w-4xl", className)} {...props} />;
}

/** Compact in-app accordion: bordered card, indigo active title. */
export function CompactAccordion(props: EntriesProps) {
  return <Entries variant="compact" {...props} />;
}
