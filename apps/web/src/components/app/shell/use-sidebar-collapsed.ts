"use client";

import * as React from "react";

const KEY = "wuup_sidebar_collapsed";
const EVENT = "wuup:sidebar-collapsed";

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Desktop rail mode (64px), persisted in localStorage. */
export function useSidebarCollapsed(): [boolean, (next: boolean) => void] {
  const collapsed = React.useSyncExternalStore(subscribe, read, () => false);
  const set = React.useCallback((next: boolean) => {
    try {
      window.localStorage.setItem(KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [collapsed, set];
}
