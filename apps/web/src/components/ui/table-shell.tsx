import * as React from "react";
import { cn } from "@/lib/cn";

/*
  Kit table (pricing rate table + DESIGN.md 11): white card, 12px uppercase
  +0.08em #666 headers, 14px rows, hairline dividers, tabular numbers.
  Options: `stickyHeader` (with `maxHeight`) and `stacked` (rows become cards
  below 640px; give each <Td> a `label`).
  Explicit ARIA roles keep table semantics when CSS changes display in stacked mode.
*/

export interface TableShellProps extends React.HTMLAttributes<HTMLDivElement> {
  stickyHeader?: boolean;
  /** Scroll area height when stickyHeader is on (CSS length or px). */
  maxHeight?: number | string;
  /** Mobile (<640px) stacked-cards layout. */
  stacked?: boolean;
  /** Visually hidden caption (accessible name for the table). */
  caption?: React.ReactNode;
  /** Optional toolbar row above the table (title, filters, actions). */
  toolbar?: React.ReactNode;
  tableClassName?: string;
}

export function TableShell({
  stickyHeader,
  maxHeight = 420,
  stacked,
  caption,
  toolbar,
  className,
  tableClassName,
  children,
  ...props
}: TableShellProps) {
  return (
    <div
      data-stacked={stacked ? "true" : undefined}
      className={cn(
        "group/table overflow-hidden rounded-2xl border border-st-secondary bg-sf-white",
        stacked && "max-sm:rounded-2xl",
        className,
      )}
      {...props}
    >
      {toolbar ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-st-secondary px-6 py-4">
          {toolbar}
        </div>
      ) : null}
      <div
        className={cn(
          "w-full overflow-x-auto",
          stickyHeader && "overflow-y-auto",
          // In stacked (card) mode the mobile list grows with the page instead of nesting a scroller.
          stickyHeader && (stacked ? "sm:max-h-(--table-max-h)" : "max-h-(--table-max-h)"),
        )}
        style={
          stickyHeader
            ? ({
                "--table-max-h": typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight,
              } as React.CSSProperties)
            : undefined
        }
        // Scrollable regions must be keyboard reachable.
        tabIndex={stickyHeader ? 0 : undefined}
        role={stickyHeader ? "region" : undefined}
        aria-label={stickyHeader && typeof caption === "string" ? caption : undefined}
      >
        <table
          role="table"
          className={cn(
            "w-full border-separate border-spacing-0 text-left text-[14px] leading-5 text-tx tabular-nums",
            stacked && "max-sm:block",
            tableClassName,
          )}
        >
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          {children}
        </table>
      </div>
    </div>
  );
}

export function Thead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      role="rowgroup"
      className={cn("group-data-[stacked=true]/table:max-sm:sr-only", className)}
      {...props}
    />
  );
}

export function Tbody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      role="rowgroup"
      className={cn("group-data-[stacked=true]/table:max-sm:block", className)}
      {...props}
    />
  );
}

export interface TrProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /** Hover tint for clickable rows. */
  interactive?: boolean;
  selected?: boolean;
}

export function Tr({ className, interactive, selected, ...props }: TrProps) {
  return (
    <tr
      role="row"
      aria-selected={selected || undefined}
      className={cn(
        "group/row transition-colors duration-150 ease-out",
        interactive && "cursor-pointer hover:bg-sf-secondary/60",
        selected && "bg-indigo-50",
        "group-data-[stacked=true]/table:max-sm:block group-data-[stacked=true]/table:max-sm:border-t group-data-[stacked=true]/table:max-sm:border-st-secondary group-data-[stacked=true]/table:max-sm:px-5 group-data-[stacked=true]/table:max-sm:py-3 group-data-[stacked=true]/table:max-sm:first:border-t-0",
        className,
      )}
      {...props}
    />
  );
}

export interface ThProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean;
  /** Stick to the top of a TableShell with stickyHeader. */
  sticky?: boolean;
}

export function Th({ className, numeric, sticky = true, ...props }: ThProps) {
  return (
    <th
      role="columnheader"
      scope="col"
      className={cn(
        "whitespace-nowrap border-b border-st-secondary bg-sf-white px-6 py-2.5 text-[12px] font-medium uppercase leading-4 tracking-[0.08em] text-tx-tertiary",
        sticky && "sticky top-0 z-[1]",
        numeric && "text-right",
        className,
      )}
      {...props}
    />
  );
}

export interface TdProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean;
  /** Column label shown before the value in the mobile stacked layout. */
  label?: string;
  /** Muted secondary column (unit, meta). */
  muted?: boolean;
  /** Make this the card title in stacked mode (label hidden, larger text). */
  primary?: boolean;
}

export function Td({ className, numeric, label, muted, primary, ...props }: TdProps) {
  return (
    <td
      role="cell"
      data-label={label}
      className={cn(
        "border-t border-st-secondary px-6 py-3 align-middle group-first/row:border-t-0",
        numeric && "text-right tabular-nums",
        muted ? "text-tx-tertiary" : "text-tx",
        primary && "font-medium",
        // stacked (mobile) layout
        "group-data-[stacked=true]/table:max-sm:flex group-data-[stacked=true]/table:max-sm:items-baseline group-data-[stacked=true]/table:max-sm:justify-between group-data-[stacked=true]/table:max-sm:gap-4 group-data-[stacked=true]/table:max-sm:border-0 group-data-[stacked=true]/table:max-sm:px-0 group-data-[stacked=true]/table:max-sm:py-1 group-data-[stacked=true]/table:max-sm:text-right",
        !primary &&
          "group-data-[stacked=true]/table:max-sm:before:content-[attr(data-label)] group-data-[stacked=true]/table:max-sm:before:text-left group-data-[stacked=true]/table:max-sm:before:text-[12px] group-data-[stacked=true]/table:max-sm:before:font-medium group-data-[stacked=true]/table:max-sm:before:uppercase group-data-[stacked=true]/table:max-sm:before:tracking-[0.08em] group-data-[stacked=true]/table:max-sm:before:text-tx-tertiary",
        primary &&
          "group-data-[stacked=true]/table:max-sm:pb-1.5 group-data-[stacked=true]/table:max-sm:text-left group-data-[stacked=true]/table:max-sm:text-[15px]",
        className,
      )}
      {...props}
    />
  );
}
