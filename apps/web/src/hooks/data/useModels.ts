"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { ModelsResponse } from "@/lib/types";

export function fetchModels(signal?: AbortSignal) {
  return api<ModelsResponse>("/user/models", { signal });
}

/** GET /user/models. The first option is always "auto". */
export function useModels(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: qk.models,
    queryFn: ({ signal }) => fetchModels(signal),
    staleTime: 5 * 60_000,
    enabled: options.enabled ?? true,
  });
}
