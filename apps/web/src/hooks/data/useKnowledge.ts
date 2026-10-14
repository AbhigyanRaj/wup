"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { DEFAULT_KNOWLEDGE_CONFIG, isInFlight, knowledgeApi, type KnowledgeSourceDTO } from "@/lib/knowledge";
import { qk } from "@/lib/query-keys";
import { setSourcesChangedHook } from "@/lib/upload";

/** Lets the module-level upload queue refresh the documents list when it changes the server. */
export function useSourcesChangedSync() {
  const qc = useQueryClient();
  useEffect(() => {
    setSourcesChangedHook(() => {
      void qc.invalidateQueries({ queryKey: qk.knowledge.list });
      void qc.invalidateQueries({ queryKey: qk.usage });
    });
  }, [qc]);
}

/** Documents. Refetches every 2s while any source is pending or indexing. */
export function useKnowledge() {
  useSourcesChangedSync();

  return useQuery({
    queryKey: qk.knowledge.list,
    queryFn: ({ signal }) => knowledgeApi.list(signal),
    refetchInterval: (q) => (q.state.data?.some(isInFlight) ? 2000 : false),
    staleTime: 10_000,
  });
}

/** GET /knowledge/config, falling back to the documented defaults. */
export function useKnowledgeConfig() {
  const q = useQuery({
    queryKey: qk.knowledge.config,
    queryFn: ({ signal }) => knowledgeApi.config(signal),
    staleTime: 30 * 60_000,
    retry: 1,
  });
  return { ...q, config: q.data ?? DEFAULT_KNOWLEDGE_CONFIG };
}

/** DELETE /knowledge/:id, removed optimistically and restored on failure. */
export function useDeleteKnowledge() {
  const qc = useQueryClient();
  return useMutation({
    meta: { silent: true },
    mutationFn: (s: Pick<KnowledgeSourceDTO, "id" | "name">) => knowledgeApi.remove(s.id),
    onMutate: async (s) => {
      await qc.cancelQueries({ queryKey: qk.knowledge.list });
      const prev = qc.getQueryData<KnowledgeSourceDTO[]>(qk.knowledge.list);
      qc.setQueryData<KnowledgeSourceDTO[]>(qk.knowledge.list, (old) => old?.filter((x) => x.id !== s.id));
      return { prev };
    },
    onError: (e, s, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.knowledge.list, ctx.prev);
      toast.error(`Couldn't delete ${s.name}`, { description: errorMessage(e) });
    },
    onSuccess: (_d, s) => toast.success(`${s.name} deleted`),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.knowledge.list });
      void qc.invalidateQueries({ queryKey: qk.usage });
    },
  });
}

/** POST /knowledge/:id/retry. The row flips to pending and the list polls. */
export function useRetryKnowledge() {
  const qc = useQueryClient();
  return useMutation({
    meta: { silent: true },
    mutationFn: (s: Pick<KnowledgeSourceDTO, "id" | "name">) => knowledgeApi.retry(s.id),
    onMutate: async (s) => {
      await qc.cancelQueries({ queryKey: qk.knowledge.list });
      const prev = qc.getQueryData<KnowledgeSourceDTO[]>(qk.knowledge.list);
      qc.setQueryData<KnowledgeSourceDTO[]>(qk.knowledge.list, (old) =>
        old?.map((x) => (x.id === s.id ? { ...x, status: "pending", errorMessage: null, progress: null } : x)),
      );
      return { prev };
    },
    onError: (e, s, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.knowledge.list, ctx.prev);
      toast.error(`Couldn't retry ${s.name}`, { description: errorMessage(e) });
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.knowledge.list }),
  });
}
