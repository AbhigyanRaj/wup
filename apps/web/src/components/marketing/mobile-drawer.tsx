"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { LOGIN, SIGNUP } from "@/lib/site";
import { cn } from "@/lib/cn";
import type { HeaderMenu } from "./header-client";
import { navIcon } from "./nav-meta";

/*
 * Kit mobile drawer (< 1024px, states/mobile-menu-open.jpg): a white sheet
 * from the top with rounded bottom corners. Rows are uppercase, letter-spaced,
 * with chevrons and hairlines; each row expands in place. Two equal 48px
 * buttons at the bottom.
 */

export function MobileDrawer({
  id,
  menus,
  pricingLive,
  onClose,
}: {
  id: string;
  menus: HeaderMenu[];
  pricingLive: boolean;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const base = useId();

  return (
    <div
      id={id}
      className="drawer top-[68px] max-h-[calc(100dvh-68px)] overflow-y-auto rounded-t-none pt-0 lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Site menu"
    >
      <nav aria-label="Main">
        <ul role="list">
          {menus.map((m, i) => {
            const open = expanded === m.label;
            const panelId = `${base}-p${i}`;
            return (
              <li key={m.label} className="border-b border-st">
                <button
                  type="button"
                  className="flex w-full items-center justify-between py-[22px] text-[15px] uppercase tracking-[0.08em] text-tx"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setExpanded(open ? null : m.label)}
                >
                  {m.label}
                  <ChevronDown
                    className={cn("size-4 transition-transform duration-300 ease-standard", open && "rotate-180")}
                    aria-hidden="true"
                  />
                </button>
                <div
                  id={panelId}
                  className={cn(
                    "grid transition-[grid-template-rows] duration-300 ease-standard",
                    open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                  )}
                >
                  <ul role="list" className={cn("min-h-0 overflow-hidden", !open && "invisible")}>
                    {m.links.map((l) => {
                      const Icon = navIcon(l.path);
                      return (
                        <li key={l.path}>
                          <Link
                            href={l.path}
                            onClick={onClose}
                            className="flex items-center gap-3 rounded-xl px-1 py-2.5 text-[16px] text-tx-secondary active:bg-sf-secondary"
                          >
                            <Icon className="size-5 text-tx-tertiary" strokeWidth={1.5} aria-hidden="true" />
                            {l.label}
                          </Link>
                        </li>
                      );
                    })}
                    <li className="h-3" aria-hidden="true" />
                  </ul>
                </div>
              </li>
            );
          })}
          {pricingLive ? (
            <li className="border-b border-st">
              <Link
                href="/pricing"
                onClick={onClose}
                className="flex w-full items-center justify-between py-[22px] text-[15px] uppercase tracking-[0.08em] text-tx"
              >
                Pricing
              </Link>
            </li>
          ) : null}
        </ul>
      </nav>
      <div className="drawer__actions">
        <ButtonLink href={LOGIN} variant="soft" onClick={onClose}>
          Log in
        </ButtonLink>
        <ButtonLink href={SIGNUP} variant="ink" onClick={onClose}>
          Start free
        </ButtonLink>
      </div>
    </div>
  );
}
