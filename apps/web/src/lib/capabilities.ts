"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { qk } from "./query-keys";
import type { Feature, MetaResponse } from "./types";

export function fetchMeta(signal?: AbortSignal) {
  return api<MetaResponse>("/meta", { signal });
}

/** GET /meta (feature flags + limits). Cached for 10 minutes. */
export function useMeta() {
  return useQuery({
    queryKey: qk.meta,
    queryFn: ({ signal }) => fetchMeta(signal),
    staleTime: 10 * 60_000,
    gcTime: 60 * 60_000,
  });
}

/**
 * True when the server advertises `feature`. While /meta is loading (or if it
 * fails) features are treated as off, so gated UI never flashes in and out.
 */
export function hasFeature(meta: MetaResponse | undefined, feature: Feature): boolean {
  return !!meta?.features.includes(feature);
}

/** Hook form of `hasFeature`. */
export function useFeature(feature: Feature): boolean {
  const { data } = useMeta();
  return hasFeature(data, feature);
}
