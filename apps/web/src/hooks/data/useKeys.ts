"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { LlmProvider, UsageResponse } from "@/lib/types";
import { useUsage } from "./useUsage";

export interface ActiveKey {
  provider: LlmProvider;
  maskedKey: string;
}

/** The saved bring-your-own key (one at a time), read from GET /user/usage. */
export function useKeys() {
  const usage = useUsage();
  const u = usage.data as (UsageResponse & Record<string, unknown>) | undefined;
  let active: ActiveKey | null = null;
  if (u?.apiKey) active = u.apiKey;
  else if (u?.hasCustomKey) {
    active = { provider: (u.provider as LlmProvider) ?? "gemini", maskedKey: (u.maskedKey as string) ?? "" };
  }
  return { ...usage, active };
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: qk.usage });
  void qc.invalidateQueries({ queryKey: qk.models });
  void qc.invalidateQueries({ queryKey: qk.me });
}

/** PUT /user/api-key. The server validates the key with the provider. */
export function useSaveKey() {
  const qc = useQueryClient();
  return useMutation({
    meta: { silent: true },
    mutationFn: (body: { provider: LlmProvider; apiKey: string }) =>
      api<{ message?: string; maskedKey?: string }>("/user/api-key", { method: "PUT", json: body }),
    onSettled: () => invalidateAll(qc),
  });
}

/** DELETE /user/api-key. */
export function useRemoveKey() {
  const qc = useQueryClient();
  return useMutation({
    meta: { silent: true },
    mutationFn: () => api<{ message?: string }>("/user/api-key", { method: "DELETE" }),
    onSettled: () => invalidateAll(qc),
  });
}
