"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Database, PanelLeftClose, PanelLeftOpen, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useBridges } from "@/hooks/data/useBridges";
import { isMac } from "@/hooks/useHotkeys";
import { EASE_STANDARD, overlayClass, useReturnFocus } from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { Wordmark, Mark } from "@/components/ui/wordmark";
import { useAppUI } from "@/components/app/app-ui-provider";
import { APP_ROUTES } from "@/components/app/nav";
import { AccountMenu } from "./account-menu";
import { ChatList } from "./chat-list";
import { NavButton, NavLink } from "./nav-item";
import { UsageMeter } from "./usage-meter";
import { useSidebarCollapsed } from "./use-sidebar-collapsed";

export const SIDEBAR_WIDTH = 272;
export const SIDEBAR_RAIL_WIDTH = 64;

function ErrorDot({ label }: { label?: string }) {
  return (
    <span className="relative flex size-2 shrink-0" role={label ? "img" : undefined} aria-label={label}>
      <span className="size-2 rounded-full bg-red-400 ring-2 ring-sf-white" />
    </span>
  );
}

const noopSubscribe = () => () => {};

/** "⌘" on Apple platforms, "Ctrl" elsewhere ("⌘" during SSR). */
export function useModKey(): string {
  return React.useSyncExternalStore(
    noopSubscribe,
    () => (isMac() ? "⌘" : "Ctrl"),
    () => "⌘",
  );
}

/** Sidebar body, shared by the docked sidebar and the mobile drawer. */
export function SidebarContent({
  collapsed = false,
  mobile = false,
  onToggleCollapsed,
  onNavigate,
}: {
  collapsed?: boolean;
  mobile?: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname() ?? "";
  const { openCommand } = useAppUI();
  const bridges = useBridges();
  const hasBridgeError = !!bridges.data?.some((b) => b.status === "error");
  const mod = useModKey();

  const newChatActive = pathname === APP_ROUTES.newChat;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className={cn("flex h-14 shrink-0 items-center", collapsed ? "justify-center px-3" : "justify-between pl-[18px] pr-3")}>
        {collapsed ? (
          <Tooltip content="Expand sidebar" side="right">
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label="Expand sidebar"
              className="group/brand relative flex size-10 items-center justify-center rounded-lg outline-none hover:bg-sf-secondary focus-visible:outline-2 focus-visible:outline-indigo-400"
            >
              <Mark size={26} className="transition-opacity duration-150 group-hover/brand:opacity-0 group-focus-visible/brand:opacity-0" />
              <PanelLeftOpen
                className="absolute size-[18px] text-tx-tertiary opacity-0 transition-opacity duration-150 group-hover/brand:opacity-100 group-focus-visible/brand:opacity-100"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </button>
          </Tooltip>
        ) : (
          <>
            <Link
              href={APP_ROUTES.newChat}
              onClick={onNavigate}
              aria-label="wuup home"
              className="-mx-1 rounded-md px-1 outline-none focus-visible:outline-2 focus-visible:outline-indigo-400"
            >
              <Wordmark size={22} />
            </Link>
            {mobile ? (
              <DialogPrimitive.Close
                aria-label="Close menu"
                className="flex size-9 items-center justify-center rounded-lg text-tx-tertiary transition-colors hover:bg-sf-secondary hover:text-tx focus-visible:outline-2 focus-visible:outline-indigo-400"
              >
                <X className="size-[18px]" strokeWidth={1.5} aria-hidden="true" />
              </DialogPrimitive.Close>
            ) : (
              <Tooltip content="Collapse sidebar" side="right">
                <button
                  type="button"
                  onClick={onToggleCollapsed}
                  aria-label="Collapse sidebar"
                  className="flex size-9 items-center justify-center rounded-lg text-tx-tertiary transition-colors hover:bg-sf-secondary hover:text-tx focus-visible:outline-2 focus-visible:outline-indigo-400"
                >
                  <PanelLeftClose className="size-[18px]" strokeWidth={1.5} aria-hidden="true" />
                </button>
              </Tooltip>
            )}
          </>
        )}
      </div>

      {/* Primary actions */}
      <div className={cn("flex shrink-0 flex-col gap-0.5 pt-1", collapsed ? "items-center px-3" : "px-3")}>
        {collapsed ? (
          <Tooltip content="New chat" side="right">
            <Link
              href={APP_ROUTES.newChat}
              aria-label="New chat"
              aria-current={newChatActive ? "page" : undefined}
              className="mb-2 flex size-10 items-center justify-center rounded-full bg-ink text-white shadow-btn-ink transition-[background-color,transform] duration-200 hover:bg-[#363944] active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
            >
              <Plus className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </Tooltip>
        ) : (
          <Link
            href={APP_ROUTES.newChat}
            onClick={onNavigate}
            aria-current={newChatActive ? "page" : undefined}
            className="mb-2 flex h-10 items-center gap-2 rounded-full bg-ink pl-3.5 pr-4 text-[14px] font-medium text-white shadow-btn-ink transition-[background-color,transform] duration-200 hover:bg-[#363944] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
          >
            <Plus className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
            <span className="flex-1">New chat</span>
          </Link>
        )}
        <NavButton
          icon={<Search />}
          label="Search"
          collapsed={collapsed}
          onClick={() => {
            onNavigate?.();
            openCommand();
          }}
          trailing={
            <kbd className="kbd hidden font-sans! text-[11.5px]! tracking-[0.04em] lg:inline-flex" aria-hidden="true">
              {mod === "⌘" ? "⌘K" : "Ctrl K"}
            </kbd>
          }
        />
        <NavLink
          href={APP_ROUTES.data}
          icon={<Database />}
          label="Data sources"
          collapsed={collapsed}
          active={pathname.startsWith("/data")}
          onNavigate={onNavigate}
          badge={hasBridgeError ? <ErrorDot label="A data source needs attention" /> : undefined}
        />
      </div>

      {/* Chats */}
      {collapsed ? (
        <div className="flex-1" />
      ) : (
        <div className="relative mt-3 min-h-0 flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-3 bg-gradient-to-b from-sf-white to-transparent" />
          <div className="h-full overflow-y-auto overscroll-contain px-3 [scrollbar-gutter:stable] [scrollbar-width:thin]">
            <ChatList onNavigate={onNavigate} />
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-4 bg-gradient-to-t from-sf-white to-transparent" />
        </div>
      )}

      {/* Footer */}
      <div className={cn("shrink-0 border-t border-st-secondary", collapsed ? "flex flex-col items-center px-3 py-3" : "space-y-2 p-3")}>
        {collapsed ? null : <UsageMeter onNavigate={onNavigate} />}
        <AccountMenu collapsed={collapsed} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

/** Docked sidebar (1024px and up). */
export function DesktopSidebar() {
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  return (
    <aside
      aria-label="Sidebar"
      data-collapsed={collapsed || undefined}
      style={{ width: collapsed ? SIDEBAR_RAIL_WIDTH : SIDEBAR_WIDTH }}
      className="hidden h-dvh shrink-0 border-r border-st-secondary bg-sf-white transition-[width] duration-300 ease-standard motion-reduce:transition-none lg:block"
    >
      <SidebarContent collapsed={collapsed} onToggleCollapsed={() => setCollapsed(!collapsed)} />
    </aside>
  );
}

/** Left drawer below 1024px. */
export function MobileSidebar() {
  const { navOpen, setNavOpen } = useAppUI();
  const reduce = useReducedMotion();
  const focusHandlers = useReturnFocus();
  const pathname = usePathname();

  // Close on route change.
  const prevPath = React.useRef(pathname);
  React.useEffect(() => {
    if (prevPath.current !== pathname) setNavOpen(false);
    prevPath.current = pathname;
  }, [pathname, setNavOpen]);

  return (
    <DialogPrimitive.Root open={navOpen} onOpenChange={setNavOpen}>
      <AnimatePresence>
        {navOpen ? (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className={overlayClass}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.25, ease: EASE_STANDARD }}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild forceMount aria-describedby={undefined} {...focusHandlers}>
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ duration: reduce ? 0 : 0.3, ease: EASE_STANDARD }}
                style={{ width: SIDEBAR_WIDTH + 16 }}
                className="fixed inset-y-0 left-0 z-[101] max-w-[calc(100vw-48px)] border-r border-st-secondary bg-sf-white pb-[env(safe-area-inset-bottom)] shadow-[0_12px_40px_-8px_#0000001f] focus:outline-none"
              >
                <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>
                <SidebarContent mobile onNavigate={() => setNavOpen(false)} />
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
