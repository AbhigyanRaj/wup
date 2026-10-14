"use client";

import * as React from "react";

function subscribe(query: string) {
  return (cb: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener("change", cb);
    return () => mql.removeEventListener("change", cb);
  };
}

/**
 * SSR-safe media query. Returns `serverValue` (default false) during SSR and
 * hydration, then the live match.
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const sub = React.useMemo(() => subscribe(query), [query]);
  return React.useSyncExternalStore(
    sub,
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

/** True at the app's desktop breakpoint (sidebar docked), 1024px and up. */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)", true);
}
