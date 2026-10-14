"use client";

import * as React from "react";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { ApiError, errorMessage } from "@/lib/api";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster, toast } from "@/components/ui/toast";
import { AuthProvider } from "./auth-provider";

export { AuthProvider, useAuth, fetchMe, type AuthContextValue } from "./auth-provider";

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      /** Set to true to skip the global error toast (the caller shows its own). */
      silent?: boolean;
      /** Custom toast text for a failed mutation. */
      errorMessage?: string;
    };
  }
}

function shouldRetry(failureCount: number, error: unknown) {
  if (failureCount >= 2) return false;
  if (error instanceof ApiError) return error.status >= 500 || error.status === 0;
  return false;
}

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: shouldRetry,
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: false,
      },
    },
    mutationCache: new MutationCache({
      onError(error, _vars, _ctx, mutation) {
        if (mutation.meta?.silent) return;
        // 401s are handled by the AuthProvider (redirect + its own toast).
        if (error instanceof ApiError && error.status === 401) return;
        if ((error as Error)?.name === "AbortError") return;
        toast.error(mutation.meta?.errorMessage ?? errorMessage(error));
      },
    }),
  });
}

/**
 * Everything the authenticated app needs: React Query, auth, tooltips,
 * reduced-motion-aware framer-motion and the toast host.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(makeQueryClient);
  return (
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="user">
        <TooltipProvider>
          <AuthProvider>{children}</AuthProvider>
          <Toaster />
        </TooltipProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
