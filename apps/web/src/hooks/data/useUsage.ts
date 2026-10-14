"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { UsageResponse } from "@/lib/types";

export function fetchUsage(signal?: AbortSignal, days = 30) {
  return api<UsageResponse>("/user/usage", { signal, query: { days } });
}

/** GET /user/usage?days=30. Invalidate `qk.usage` after each answer (`done`). */
export function useUsage(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: qk.usage,
    queryFn: ({ signal }) => fetchUsage(signal),
    staleTime: 60_000,
    enabled: options.enabled ?? true,
  });
}
