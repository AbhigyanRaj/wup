"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers";
import { useHotkeys } from "@/hooks/useHotkeys";
import { AppUIProvider, useAppUI } from "@/components/app/app-ui-provider";
import { APP_ROUTES } from "@/components/app/nav";
import { welcomeSeenLocally } from "@/components/app/welcome-state";
import { AuthGate } from "./auth-gate";
import { DesktopSidebar, MobileSidebar } from "./sidebar";
import { SkipLink } from "./skip-link";
import { TopBar, TopBarProvider } from "./top-bar";

/** Custom events the shell dispatches on `window` for the chat screen. */
export const APP_EVENTS = {
  focusComposer: "wuup:focus-composer",
  toggleResearch: "wuup:toggle-research",
} as const;

export function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    <AppUIProvider>
      <AuthGate>
        <TopBarProvider>
          <Shell>{children}</Shell>
        </TopBarProvider>
      </AuthGate>
    </AppUIProvider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { toggleCommand, openDialog, commandOpen, dialog } = useAppUI();
  const { user } = useAuth();

  useHotkeys("mod+k", () => toggleCommand());
  useHotkeys("mod+shift+o", () => router.push(APP_ROUTES.newChat));
  useHotkeys(
    "/",
    () => window.dispatchEvent(new CustomEvent(APP_EVENTS.focusComposer)),
    { enabled: !commandOpen && !dialog },
  );

  // First visit: show the welcome dialog once.
  const welcomeShown = React.useRef(false);
  React.useEffect(() => {
    if (!user || welcomeShown.current) return;
    if (user.onboarding?.welcomeSeenAt || welcomeSeenLocally()) return;
    const t = window.setTimeout(() => {
      welcomeShown.current = true;
      openDialog("welcome");
    }, 400);
    return () => window.clearTimeout(t);
  }, [user, openDialog]);

  return (
    <div className="flex h-dvh overflow-hidden bg-bg">
      <SkipLink />
      <DesktopSidebar />
      <MobileSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main id="main" tabIndex={-1} className="relative min-h-0 flex-1 overflow-y-auto focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
