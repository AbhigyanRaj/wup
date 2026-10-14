"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, api, onUnauthorized } from "@/lib/api";
import { LOGOUT_SIGNAL_KEY, TOKEN_KEY, clearToken, hasAuthCookie, markAuthed } from "@/lib/auth-token";
import { qk } from "@/lib/query-keys";
import type { AuthResponse, AuthStatus, UserDTO } from "@/lib/types";
import { toast } from "@/components/ui/toast";

export interface AuthContextValue {
  status: AuthStatus;
  /** The signed-in user (null while loading or when signed out). */
  user: UserDTO | null;
  /** POST /auth/logout, clear local session + cache, go to /login. */
  logout: () => Promise<void>;
  /** Re-fetch GET /auth/me (e.g. after changing the profile). */
  refresh: () => Promise<void>;
  /** True once a logout or session-expiry redirect is under way. */
  redirecting: boolean;
  /** The session check failed for a reason other than 401 (API down, 5xx). */
  unreachable: boolean;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

/**
 * GET /auth/me, falling back to the legacy GET /auth/verify when /auth/me does
 * not exist yet. Returns null for "not signed in" (401), throws otherwise.
 */
export async function fetchMe(signal?: AbortSignal): Promise<UserDTO | null> {
  try {
    const res = await api<AuthResponse>("/auth/me", { signal, skipAuthHandler: true });
    return res.user;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      clearToken();
      return null;
    }
    if (e instanceof ApiError && e.status === 404) {
      try {
        const res = await api<AuthResponse>("/auth/verify", { signal, skipAuthHandler: true });
        return res.user;
      } catch (e2) {
        if (e2 instanceof ApiError && e2.status === 401) {
          clearToken();
          return null;
        }
        throw e2;
      }
    }
    throw e;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const pathRef = React.useRef(pathname);
  React.useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  const me = useQuery({
    queryKey: qk.me,
    queryFn: ({ signal }) => fetchMe(signal),
    staleTime: 5 * 60_000,
    retry: (count, err) => err instanceof ApiError && err.status >= 500 && count < 2,
  });

  const user = me.data ?? null;
  const status: AuthStatus = me.isPending
    ? "loading"
    : user
      ? "authenticated"
      : me.isError
        ? // The API is unreachable: keep the shell up if we were signed in before.
          hasAuthCookie()
          ? "loading"
          : "unauthenticated"
        : "unauthenticated";

  // Keep the proxy marker cookie in sync with the real session.
  React.useEffect(() => {
    if (user) markAuthed();
    else if (me.isSuccess && !user) clearToken();
  }, [user, me.isSuccess]);

  const endingRef = React.useRef(false);
  const [redirecting, setRedirecting] = React.useState(false);

  const resetLocal = React.useCallback(() => {
    queryClient.cancelQueries();
    queryClient.clear();
  }, [queryClient]);

  // 401 from any request: the session ended.
  React.useEffect(() => {
    return onUnauthorized(() => {
      if (endingRef.current) return;
      endingRef.current = true;
      setRedirecting(true);
      const current = typeof window !== "undefined" ? window.location.pathname + window.location.search : pathRef.current;
      clearToken();
      resetLocal();
      toast("Your session ended. Log in again.", { id: "session-ended" });
      router.replace(`/login?next=${encodeURIComponent(current)}&reason=expired`);
    });
  }, [router, resetLocal]);

  // Logout in another tab.
  React.useEffect(() => {
    function onStorage(e: StorageEvent) {
      const loggedOutElsewhere =
        e.key === LOGOUT_SIGNAL_KEY || (e.key === TOKEN_KEY && e.oldValue && !e.newValue);
      if (!loggedOutElsewhere || endingRef.current) return;
      endingRef.current = true;
      setRedirecting(true);
      clearToken();
      resetLocal();
      router.replace("/login");
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [router, resetLocal]);

  const logout = React.useCallback(async () => {
    endingRef.current = true;
    setRedirecting(true);
    try {
      await api("/auth/logout", { method: "POST", skipAuthHandler: true });
    } catch {
      /* the local session is cleared regardless */
    }
    clearToken({ broadcast: true });
    resetLocal();
    router.replace("/login");
  }, [router, resetLocal]);

  const refresh = React.useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: qk.me });
  }, [queryClient]);

  const value = React.useMemo<AuthContextValue>(
    () => ({ status, user, logout, refresh, redirecting, unreachable: me.isError && !user }),
    [status, user, logout, refresh, redirecting, me.isError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AppProviders>");
  return ctx;
}
