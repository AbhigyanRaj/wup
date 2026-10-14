"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Menu, SquarePen } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { useAppUI } from "@/components/app/app-ui-provider";
import { APP_ROUTES } from "@/components/app/nav";
import { Wordmark } from "@/components/ui/wordmark";

interface TopBarTargets {
  titleEl: HTMLElement | null;
  actionsEl: HTMLElement | null;
}

const TopBarContext = React.createContext<TopBarTargets>({ titleEl: null, actionsEl: null });

/**
 * Lets a page put its own title and actions into the shell's top bar:
 *
 *   <TopBarSlot title={<ChatTitle />} actions={<Button size="sm">Export</Button>} />
 *
 * Content is portalled, so it keeps the page's React context. When no page
 * provides a title the top bar falls back to the section name.
 */
export function TopBarSlot({ title, actions }: { title?: React.ReactNode; actions?: React.ReactNode }) {
  const { titleEl, actionsEl } = React.useContext(TopBarContext);
  return (
    <>
      {title !== undefined && titleEl ? createPortal(title, titleEl) : null}
      {actions !== undefined && actionsEl ? createPortal(actions, actionsEl) : null}
    </>
  );
}

export function TopBarProvider({ children }: { children: React.ReactNode }) {
  const [titleEl, setTitleEl] = React.useState<HTMLElement | null>(null);
  const [actionsEl, setActionsEl] = React.useState<HTMLElement | null>(null);
  const value = React.useMemo(() => ({ titleEl, actionsEl }), [titleEl, actionsEl]);
  return (
    <TopBarContext.Provider value={value}>
      <TopBarRefs.Provider value={{ setTitleEl, setActionsEl }}>{children}</TopBarRefs.Provider>
    </TopBarContext.Provider>
  );
}

const TopBarRefs = React.createContext<{
  setTitleEl: (el: HTMLElement | null) => void;
  setActionsEl: (el: HTMLElement | null) => void;
}>({ setTitleEl: () => {}, setActionsEl: () => {} });

export function TopBar() {
  const { setTitleEl, setActionsEl } = React.useContext(TopBarRefs);
  const { setNavOpen, navOpen } = useAppUI();

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 lg:has-[[data-slot=topbar-title]:empty]:has-[[data-slot=topbar-actions]:empty]:hidden items-center gap-2 border-b border-st-secondary bg-bg/85 px-3 backdrop-blur-md supports-[backdrop-filter]:bg-bg/75 sm:px-4 lg:px-6">
      <IconButton
        aria-label="Open menu"
        aria-expanded={navOpen}
        size="md"
        className="-ml-1 lg:hidden"
        onClick={() => setNavOpen(true)}
      >
        <Menu strokeWidth={1.5} />
      </IconButton>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div ref={setTitleEl} data-slot="topbar-title" className="peer flex min-w-0 items-center gap-2 empty:hidden" />
        <Link
          href={APP_ROUTES.newChat}
          aria-label="wuup, new chat"
          className="hidden rounded-md outline-none peer-empty:inline-flex focus-visible:outline-2 focus-visible:outline-indigo-400 lg:peer-empty:hidden"
        >
          <Wordmark size={20} />
        </Link>
      </div>

      <div ref={setActionsEl} data-slot="topbar-actions" className="flex shrink-0 items-center gap-2 empty:hidden" />

      <Link
        href={APP_ROUTES.newChat}
        aria-label="New chat"
        className="icon-btn icon-btn--ghost -mr-1 lg:hidden"
      >
        <SquarePen strokeWidth={1.5} />
      </Link>
    </header>
  );
}
