"use client";

import { useCallback, useEffect, useRef } from "react";

/*
 * Optional Cloudflare Turnstile. Active only when
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY is set (the API checks tokens only when
 * TURNSTILE_SECRET_KEY is set). Renders an invisible, execute-on-demand
 * widget; getToken() resolves to a token, or undefined when disabled.
 */

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  execute: (id: string) => void;
  reset: (id: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export function useTurnstile() {
  const el = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const pending = useRef<((t: string | undefined) => void) | null>(null);

  useEffect(() => {
    if (!SITE_KEY || !el.current) return;
    const mount = () => {
      if (!window.turnstile || !el.current || widget.current) return;
      widget.current = window.turnstile.render(el.current, {
        sitekey: SITE_KEY,
        execution: "execute",
        appearance: "interaction-only",
        callback: (token: string) => {
          pending.current?.(token);
          pending.current = null;
        },
        "error-callback": () => {
          pending.current?.(undefined);
          pending.current = null;
        },
      });
    };
    if (window.turnstile) mount();
    else {
      let s = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
      if (!s) {
        s = document.createElement("script");
        s.src = SCRIPT;
        s.async = true;
        document.head.appendChild(s);
      }
      s.addEventListener("load", mount);
      return () => s?.removeEventListener("load", mount);
    }
  }, []);

  const getToken = useCallback(async (): Promise<string | undefined> => {
    if (!SITE_KEY || !window.turnstile || !widget.current) return undefined;
    const id = widget.current;
    return new Promise((resolve) => {
      pending.current = resolve;
      window.turnstile!.reset(id);
      window.turnstile!.execute(id);
      setTimeout(() => {
        if (pending.current === resolve) {
          pending.current = null;
          resolve(undefined);
        }
      }, 15000);
    });
  }, []);

  return { getToken, slot: SITE_KEY ? <div ref={el} className="empty:hidden" /> : null };
}
