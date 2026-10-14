"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Tooltip } from "@/components/ui/tooltip";

export const navItemClass = (active: boolean, collapsed = false) =>
  cn(
    "group/nav relative flex h-[34px] w-full items-center gap-2.5 rounded-lg text-left text-[14px] leading-5 outline-none transition-colors duration-150 ease-out",
    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-400",
    collapsed ? "justify-center px-0" : "px-2.5",
    active ? "bg-sf-secondary text-tx" : "text-tx-tertiary hover:bg-sf-secondary/70 hover:text-tx",
  );

const iconClass =
  "flex size-[18px] shrink-0 items-center justify-center [&_svg]:size-[18px] [&_svg]:stroke-[1.5]";

interface NavItemBaseProps {
  icon: React.ReactNode;
  label: string;
  /** Right-aligned hint (a Kbd or a status dot). Hidden in the rail. */
  trailing?: React.ReactNode;
  /** A small dot on the icon, shown in both modes (e.g. bridge error). */
  badge?: React.ReactNode;
  collapsed?: boolean;
  active?: boolean;
}

function Inner({ icon, label, trailing, badge, collapsed }: NavItemBaseProps) {
  return (
    <>
      <span className={cn(iconClass, "relative")} aria-hidden="true">
        {icon}
        {collapsed && badge ? <span className="absolute -right-1 -top-1">{badge}</span> : null}
      </span>
      {collapsed ? (
        <span className="sr-only">{label}</span>
      ) : (
        <>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {badge}
          {trailing}
        </>
      )}
    </>
  );
}

function withTooltip(collapsed: boolean | undefined, label: string, node: React.ReactElement) {
  if (!collapsed) return node;
  return (
    <Tooltip content={label} side="right">
      {node}
    </Tooltip>
  );
}

export function NavLink({
  href,
  onNavigate,
  ...rest
}: NavItemBaseProps & { href: string; onNavigate?: () => void }) {
  return withTooltip(
    rest.collapsed,
    rest.label,
    <Link
      href={href}
      aria-current={rest.active ? "page" : undefined}
      className={navItemClass(!!rest.active, rest.collapsed)}
      onClick={onNavigate}
    >
      <Inner {...rest} />
    </Link>,
  );
}

export function NavButton({ onClick, ...props }: NavItemBaseProps & { onClick: () => void }) {
  return withTooltip(
    props.collapsed,
    props.label,
    <button type="button" onClick={onClick} className={navItemClass(!!props.active, props.collapsed)}>
      <Inner {...props} />
    </button>,
  );
}
