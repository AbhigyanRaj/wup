"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearToken } from "@/lib/auth-token";
import { useAuth } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Wordmark } from "@/components/ui/wordmark";
import { AppSkeleton } from "./app-skeleton";

/** Renders the app only for a signed-in user; otherwise redirects to /login?next=. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status, redirecting, unreachable, refresh } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [retrying, setRetrying] = React.useState(false);

  React.useEffect(() => {
    if (status !== "unauthenticated" || redirecting) return;
    clearToken();
    const next = `${window.location.pathname}${window.location.search}` || pathname || "/chat";
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [status, redirecting, router, pathname]);

  if (status === "authenticated") return <>{children}</>;

  if (unreachable && !redirecting) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-bg px-4">
        <Wordmark size={24} className="mb-2" />
        <EmptyState
          as="h2"
          title="Can't reach wuup right now"
          description="Your chats and data are safe. Check your connection, then try again."
          action={
            <Button
              variant="ink"
              size="sm"
              disabled={retrying}
              onClick={async () => {
                setRetrying(true);
                await refresh().finally(() => setRetrying(false));
              }}
            >
              {retrying ? "Trying..." : "Try again"}
            </Button>
          }
        />
      </main>
    );
  }

  return <AppSkeleton />;
}
