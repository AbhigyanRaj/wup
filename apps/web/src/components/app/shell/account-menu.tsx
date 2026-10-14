"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, Gauge, LogOut, Settings } from "lucide-react";
import { cn } from "@/lib/cn";
import { useAuth } from "@/components/providers";
import { MenuContent, MenuItem, MenuRoot, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Tooltip } from "@/components/ui/tooltip";
import { APP_ROUTES } from "@/components/app/nav";

export function initialsOf(name: string | null | undefined, email: string | null | undefined): string {
  const base = (name ?? "").trim() || (email ?? "").split("@")[0] || "";
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : base.slice(0, 1);
  return (letters || "?").toUpperCase();
}

export function Avatar({ initials, size = 28 }: { initials: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size <= 28 ? 11.5 : 13 }}
      className="flex shrink-0 items-center justify-center rounded-full bg-indigo-100 font-medium tracking-[0.02em] text-indigo-800 ring-1 ring-inset ring-indigo-200"
    >
      {initials}
    </span>
  );
}

export function AccountMenu({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const name = user?.name?.trim() || (user?.isDemo ? "Demo user" : user?.email?.split("@")[0]) || "Account";
  const initials = initialsOf(user?.name, user?.isDemo ? "demo" : user?.email);
  const subtitle = user?.isDemo ? "Demo sandbox" : user?.email;

  const go = (href: string) => {
    onNavigate?.();
    router.push(href);
  };

  const trigger = (
    <button
      type="button"
      aria-label={collapsed ? `Account: ${name}` : undefined}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg text-left outline-none transition-colors duration-150",
        "hover:bg-sf-secondary/70 data-[state=open]:bg-sf-secondary",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-400",
        collapsed ? "size-10 justify-center" : "h-12 px-2",
      )}
    >
      <Avatar initials={initials} />
      {collapsed ? null : (
        <>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[14px] leading-5 text-tx">{name}</span>
            {subtitle ? (
              <span className="truncate text-[12px] leading-4 text-tx-tertiary">{subtitle}</span>
            ) : null}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-tx-muted" strokeWidth={1.5} aria-hidden="true" />
        </>
      )}
    </button>
  );

  return (
    <MenuRoot>
      {collapsed ? (
        <Tooltip content={name} side="right">
          <MenuTrigger asChild>{trigger}</MenuTrigger>
        </Tooltip>
      ) : (
        <MenuTrigger asChild>{trigger}</MenuTrigger>
      )}
      <MenuContent side="top" align="start" sideOffset={8} className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[232px]">
        <MenuItem icon={<Settings />} onSelect={() => go(APP_ROUTES.settings)}>
          Settings
        </MenuItem>
        <MenuItem icon={<Gauge />} onSelect={() => go(APP_ROUTES.usage)}>
          Usage &amp; plan
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={<LogOut />} onSelect={() => void logout()}>
          Log out
        </MenuItem>
      </MenuContent>
    </MenuRoot>
  );
}
