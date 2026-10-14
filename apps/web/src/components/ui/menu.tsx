"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/cn";

/*
  Menu set on Radix DropdownMenu. Kit: white panel, radius 12, 1px #e6e6e6,
  shadow-card, 6px padding. Items 34px, radius 8, 14px, hover #f5f5f5.
  Arrow keys, typeahead, Home/End and Esc come from Radix.
*/

export const MenuRoot = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;
export const MenuGroup = DropdownMenu.Group;
export const MenuSub = DropdownMenu.Sub;

export const MenuContent = React.forwardRef<
  React.ComponentRef<typeof DropdownMenu.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenu.Content>
>(function MenuContent({ className, sideOffset = 6, align = "start", ...props }, ref) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        ref={ref}
        sideOffset={sideOffset}
        align={align}
        collisionPadding={12}
        className={cn(
          "z-[120] min-w-[208px] max-w-[min(320px,calc(100vw-24px))] overflow-hidden rounded-xl border border-st bg-sf-white p-1.5 text-tx shadow-card",
          "max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto",
          "origin-(--radix-dropdown-menu-content-transform-origin)",
          "transition-[opacity,scale] duration-150 ease-standard starting:scale-[0.97] starting:opacity-0",
          "focus:outline-none",
          className,
        )}
        {...props}
      />
    </DropdownMenu.Portal>
  );
});

const itemBase =
  "relative flex h-[34px] w-full cursor-default select-none items-center gap-2.5 rounded-lg px-2.5 text-[14px] leading-5 transition-colors duration-150 ease-out " +
  "data-[highlighted]:bg-sf-secondary active:bg-sf-tertiary " +
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-400 " +
  "data-[disabled]:pointer-events-none data-[disabled]:text-tx-muted";

export interface MenuItemProps
  extends React.ComponentPropsWithoutRef<typeof DropdownMenu.Item> {
  /** 16px icon rendered in a fixed slot on the left. */
  icon?: React.ReactNode;
  /** Trailing hint such as a keyboard shortcut. */
  shortcut?: React.ReactNode;
  tone?: "default" | "danger";
}

export const MenuItem = React.forwardRef<
  React.ComponentRef<typeof DropdownMenu.Item>,
  MenuItemProps
>(function MenuItem({ className, icon, shortcut, tone = "default", children, ...props }, ref) {
  const danger = tone === "danger";
  return (
    <DropdownMenu.Item
      ref={ref}
      className={cn(
        itemBase,
        danger
          ? "text-red-400 data-[highlighted]:bg-red-50 active:bg-red-50"
          : "text-tx",
        className,
      )}
      {...props}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className={cn(
            "flex size-4 shrink-0 items-center justify-center [&_svg]:size-4 [&_svg]:stroke-[1.5]",
            danger ? "text-red-400" : "text-tx-tertiary",
          )}
        >
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {shortcut ? (
        <span className="ml-4 shrink-0 font-mono text-[12px] text-tx-muted">{shortcut}</span>
      ) : null}
    </DropdownMenu.Item>
  );
});

export const MenuCheckboxItem = React.forwardRef<
  React.ComponentRef<typeof DropdownMenu.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenu.CheckboxItem>
>(function MenuCheckboxItem({ className, children, ...props }, ref) {
  return (
    <DropdownMenu.CheckboxItem ref={ref} className={cn(itemBase, "text-tx", className)} {...props}>
      <span
        aria-hidden="true"
        className="relative flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-tx-muted bg-sf-white"
      >
        <DropdownMenu.ItemIndicator className="absolute -inset-px flex items-center justify-center rounded-[4px] bg-indigo-600 text-white">
          {props.checked === "indeterminate" ? (
            <Minus className="size-3" strokeWidth={2.5} />
          ) : (
            <Check className="size-3" strokeWidth={2.5} />
          )}
        </DropdownMenu.ItemIndicator>
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </DropdownMenu.CheckboxItem>
  );
});

export const MenuLabel = React.forwardRef<
  React.ComponentRef<typeof DropdownMenu.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenu.Label>
>(function MenuLabel({ className, ...props }, ref) {
  return (
    <DropdownMenu.Label
      ref={ref}
      className={cn(
        "px-2.5 pt-2 pb-1.5 text-[12px] font-medium uppercase leading-4 tracking-[0.08em] text-tx-tertiary",
        className,
      )}
      {...props}
    />
  );
});

export const MenuSeparator = React.forwardRef<
  React.ComponentRef<typeof DropdownMenu.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenu.Separator>
>(function MenuSeparator({ className, ...props }, ref) {
  return (
    <DropdownMenu.Separator
      ref={ref}
      className={cn("-mx-1.5 my-1.5 h-px bg-st-secondary", className)}
      {...props}
    />
  );
});

/**
 * Namespace export for client components: `<Menu.Root>`, `<Menu.Item>` ...
 * Server components cannot dot into client modules; use the named exports there.
 */
export const Menu = {
  Root: MenuRoot,
  Trigger: MenuTrigger,
  Content: MenuContent,
  Item: MenuItem,
  CheckboxItem: MenuCheckboxItem,
  Label: MenuLabel,
  Separator: MenuSeparator,
  Group: MenuGroup,
};
