"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "@/components/providers/auth-provider";
import { qk } from "@/lib/query-keys";

/**
 * The signed-in user (GET /auth/me). Shares its cache with `useAuth()`, so
 * after a PATCH you can `queryClient.setQueryData(qk.me, user)`.
 */
export function useMe() {
  return useQuery({
    queryKey: qk.me,
    queryFn: ({ signal }) => fetchMe(signal),
    staleTime: 5 * 60_000,
  });
}
