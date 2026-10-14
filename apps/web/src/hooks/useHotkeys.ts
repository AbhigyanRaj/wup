"use client";

import * as React from "react";

/**
 * Hotkey spec: "mod+k", "mod+shift+o", "/", "escape". `mod` matches Cmd or
 * Ctrl. Keys are matched on `event.key`, case-insensitive.
 */
export type HotkeySpec = string;

export interface HotkeyOptions {
  /** Fire even while typing in an input, textarea or contenteditable. Default: true for "mod" combos, false otherwise. */
  enableInInputs?: boolean;
  preventDefault?: boolean;
  enabled?: boolean;
}

export function isMac(): boolean {
  if (typeof navigator === "undefined") return true;
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform ??
    "";
  return /mac|iphone|ipad|ipod/i.test(platform);
}

export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function matchesHotkey(e: KeyboardEvent, spec: HotkeySpec): boolean {
  const parts = spec.toLowerCase().split("+");
  const key = parts[parts.length - 1];
  const wantMod = parts.includes("mod");
  const wantShift = parts.includes("shift");
  const wantAlt = parts.includes("alt");
  // Accept both Cmd and Ctrl for "mod" so shortcuts work on any keyboard layout.
  const mod = e.metaKey || e.ctrlKey;
  if (wantMod !== mod) return false;
  if (wantShift !== e.shiftKey) return false;
  if (wantAlt !== e.altKey) return false;
  if (!wantMod && (e.metaKey || e.ctrlKey)) return false;
  return e.key.toLowerCase() === key;
}

/** Binds a global keydown handler for one or more hotkey specs. */
export function useHotkeys(
  spec: HotkeySpec | HotkeySpec[],
  handler: (e: KeyboardEvent) => void,
  { enableInInputs, preventDefault = true, enabled = true }: HotkeyOptions = {},
): void {
  const handlerRef = React.useRef(handler);
  React.useEffect(() => {
    handlerRef.current = handler;
  });
  const specs = Array.isArray(spec) ? spec : [spec];
  const key = specs.join("|");

  React.useEffect(() => {
    if (!enabled) return;
    const list = key.split("|");
    function onKeyDown(e: KeyboardEvent) {
      if (e.isComposing || e.defaultPrevented) return;
      for (const s of list) {
        if (!matchesHotkey(e, s)) continue;
        const allowInInputs = enableInInputs ?? s.toLowerCase().includes("mod");
        if (!allowInInputs && isTypingTarget(e.target)) return;
        if (preventDefault) e.preventDefault();
        handlerRef.current(e);
        return;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [key, enabled, enableInInputs, preventDefault]);
}
