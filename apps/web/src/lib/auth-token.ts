/*
 * Client-side session helpers.
 *
 * The real session is the API's httpOnly cookie. Two extra pieces live here:
 * - `wuup_token` in localStorage: a Bearer fallback for browsers that block
 *   third-party cookies (the API returns `token` in auth responses).
 * - `wuup_authed=1`: a NON-secret marker cookie on the web origin that
 *   `src/proxy.ts` checks to decide whether to bounce app routes to /login.
 */

export const TOKEN_KEY = "wuup_token";
export const AUTH_COOKIE = "wuup_authed";
/** Written on logout so other tabs can react through the `storage` event. */
export const LOGOUT_SIGNAL_KEY = "wuup_logout_at";

const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 7;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** The Bearer fallback token, or null. */
export function getToken(): string | null {
  try {
    return storage()?.getItem(TOKEN_KEY) ?? null;
  } catch {
    return null;
  }
}

/** Sets only the `wuup_authed` marker cookie (use after a cookie-only login). */
export function markAuthed(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_COOKIE}=1; Path=/; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE_S}`;
}

/**
 * Call after a successful login, signup or demo start. Stores the Bearer
 * fallback (when the API returned one) and sets the marker cookie.
 */
export function setToken(token?: string | null): void {
  if (token) {
    try {
      storage()?.setItem(TOKEN_KEY, token);
    } catch {
      /* storage blocked: the httpOnly cookie still works */
    }
  }
  markAuthed();
}

/**
 * Removes the Bearer fallback and the marker cookie. With `broadcast`, other
 * open tabs are told to log out too (via the `storage` event).
 */
export function clearToken({ broadcast = false }: { broadcast?: boolean } = {}): void {
  try {
    const s = storage();
    s?.removeItem(TOKEN_KEY);
    if (broadcast) s?.setItem(LOGOUT_SIGNAL_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
  if (typeof document !== "undefined") {
    document.cookie = `${AUTH_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`;
  }
}

/** True when the marker cookie is present (a cheap "probably signed in" check). */
export function hasAuthCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((c) => c.trim().startsWith(`${AUTH_COOKIE}=`));
}
