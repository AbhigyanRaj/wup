"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { LOGIN, SIGNUP } from "@/lib/site";
import { cn } from "@/lib/cn";
import { MegaMenu, type MegaFeatured, type MegaLink } from "./mega-menu";
import { MobileDrawer } from "./mobile-drawer";

export interface HeaderMenu {
  label: string;
  links: MegaLink[];
  featured?: MegaFeatured;
}

const INTENT_MS = 100;

/*
 * Header island: scroll state (white layer after scrollY > 10), mega menus
 * with a ~100ms hover intent and full keyboard support, and the < 1024px drawer.
 */
export function HeaderClient({
  menus,
  pricingLive,
  overHero,
}: {
  menus: HeaderMenu[];
  pricingLive: boolean;
  overHero: boolean;
}) {
  const [scrolled, setScrolled] = useState(!overHero);
  const [open, setOpen] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const triggers = useRef<Record<string, HTMLButtonElement | null>>({});
  /** How the open menu was opened. Pointer-leave only closes menus opened by hover. */
  const via = useRef<"hover" | "click">("hover");
  const base = useId();
  const pathname = usePathname();

  useEffect(() => {
    if (!overHero) return;
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [overHero]);

  // Close everything on route change (state adjusted during render, not in an effect).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(null);
    setDrawer(false);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (!open && !drawer) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (open) triggers.current[open]?.focus();
      setOpen(null);
      setDrawer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, drawer]);

  useEffect(() => {
    document.documentElement.style.overflow = drawer ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [drawer]);

  const schedule = useCallback((next: string | null) => {
    if (next === null && via.current === "click") return;
    if (next !== null) via.current = "hover";
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(next), INTENT_MS);
  }, []);

  const close = useCallback(() => {
    clearTimeout(timer.current);
    setOpen(null);
  }, []);

  function onTriggerKey(e: KeyboardEvent<HTMLButtonElement>, label: string) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      clearTimeout(timer.current);
      via.current = "click";
      setOpen(label);
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>(`#${CSS.escape(menuId(label))} [data-mega-link]`)?.focus(),
      );
    }
  }

  function onMenuKey(e: KeyboardEvent<HTMLDivElement>) {
    const links = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("[data-mega-link]"));
    const i = links.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      links[(i + 1) % links.length]?.focus();
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      links[(i - 1 + links.length) % links.length]?.focus();
    }
  }

  const menuId = (label: string) => `${base.replace(/:/g, "")}-mega-${label.replace(/\s+/g, "-").toLowerCase()}`;
  const current = menus.find((m) => m.label === open);
  const drawerId = `${base.replace(/:/g, "")}-drawer`;

  return (
    <header
      className={cn("site-header", (scrolled || drawer) && "is-scrolled", open && "is-open")}
      onMouseLeave={() => open && schedule(null)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close();
      }}
    >
      <div className="site-header__bg" aria-hidden="true" />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-10 focus:rounded-full focus:bg-sf-white focus:px-4 focus:py-2 focus:text-[14px] focus:shadow-card"
      >
        Skip to content
      </a>
      <div className="container site-header__row">
        <div className="site-header__brand">
          <Link href="/" aria-label="wuup home" className="inline-flex rounded-md" onClick={close}>
            <Image src="/brand/wuup-wordmark.svg" alt="wuup" width={78} height={23} unoptimized priority={false} />
          </Link>
        </div>

        <nav className="site-header__nav" aria-label="Main">
          {menus.map((m) => {
            const isOpen = open === m.label;
            return (
              <button
                key={m.label}
                ref={(el) => {
                  triggers.current[m.label] = el;
                }}
                type="button"
                className={cn("nav-item gap-1", isOpen && "text-tx-secondary")}
                aria-expanded={isOpen}
                aria-controls={menuId(m.label)}
                onMouseEnter={() => schedule(m.label)}
                onClick={() => {
                  clearTimeout(timer.current);
                  const wasClick = via.current === "click";
                  via.current = "click";
                  // A hover-opened menu stays open on click; a click-opened one toggles closed.
                  setOpen(isOpen && wasClick ? null : m.label);
                }}
                onKeyDown={(e) => onTriggerKey(e, m.label)}
              >
                {m.label}
                <ChevronDown
                  className={cn("size-3.5 text-tx-tertiary transition-transform duration-300 ease-standard", isOpen && "rotate-180")}
                  aria-hidden="true"
                />
              </button>
            );
          })}
          {pricingLive ? (
            <Link href="/pricing" className="nav-item" onMouseEnter={() => schedule(null)}>
              Pricing
            </Link>
          ) : null}
        </nav>

        <div className="site-header__actions">
          <ButtonLink href={LOGIN} variant="soft" size="sm">
            Log in
          </ButtonLink>
          <ButtonLink href={SIGNUP} variant="ink" size="sm">
            Start free
          </ButtonLink>
        </div>

        <div className="site-header__mobile">
          <ButtonLink href={LOGIN} variant="soft" size="sm">
            Log in
          </ButtonLink>
          <button
            type="button"
            className="burger size-10 rounded-full"
            aria-label={drawer ? "Close menu" : "Open menu"}
            aria-expanded={drawer}
            aria-controls={drawerId}
            onClick={() => setDrawer((d) => !d)}
          >
            {drawer ? (
              <svg width="18" height="18" viewBox="0 0 18 18" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="M2 2l14 14M16 2L2 16" />
              </svg>
            ) : (
              <svg width="20" height="14" viewBox="0 0 20 14" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="M0 1h20M0 7h20M0 13h20" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {current ? (
        <>
          <div className="mega-backdrop hidden lg:block" aria-hidden="true" onMouseEnter={() => schedule(null)} onClick={close} />
          <div className="hidden lg:block" onMouseEnter={() => clearTimeout(timer.current)}>
            <MegaMenu
              id={menuId(current.label)}
              label={current.label}
              links={current.links}
              featured={current.featured}
              onNavigate={close}
              onKeyDown={onMenuKey}
            />
          </div>
        </>
      ) : null}

      {drawer ? <MobileDrawer id={drawerId} menus={menus} pricingLive={pricingLive} onClose={() => setDrawer(false)} /> : null}
    </header>
  );
}
