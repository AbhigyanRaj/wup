"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { bridgesApi, type BridgeDetails, type BridgeSummary } from "@/lib/bridges";
import { qk } from "@/lib/query-keys";
import type { UpdateConnectionBody } from "@/lib/types";

/** All bridges. Refetches every 3s while any bridge is scanning. */
export function useBridges() {
  return useQuery({
    queryKey: qk.bridges.list,
    queryFn: () => bridgesApi.list(),
    refetchInterval: (q) => (q.state.data?.some((b) => b.status === "scanning") ? 3000 : false),
    staleTime: 15_000,
  });
}

/** One bridge with its schema. Refetches every 3s while it is scanning. */
export function useBridge(id: string | null) {
  return useQuery({
    queryKey: qk.bridges.detail(id ?? "none"),
    queryFn: () => bridgesApi.get(id as string),
    enabled: !!id,
    refetchInterval: (q) => (q.state.data?.status === "scanning" ? 3000 : false),
  });
}

function patchCaches(qc: ReturnType<typeof useQueryClient>, id: string, p: Partial<BridgeSummary>) {
  qc.setQueryData<BridgeSummary[]>(qk.bridges.list, (old) => old?.map((b) => (b.id === id ? { ...b, ...p } : b)));
  qc.setQueryData<BridgeDetails>(qk.bridges.detail(id), (old) => (old ? { ...old, ...p } : old));
}

/** PATCH /connections/:id with an optimistic cache update and rollback. */
export function useUpdateBridge() {
  const qc = useQueryClient();
  return useMutation({
    meta: { silent: true },
    mutationFn: ({ id, body }: { id: string; body: UpdateConnectionBody; successMessage?: string }) =>
      bridgesApi.update(id, body),
    onMutate: async ({ id, body }) => {
      await qc.cancelQueries({ queryKey: qk.bridges.all });
      const list = qc.getQueryData<BridgeSummary[]>(qk.bridges.list);
      const detail = qc.getQueryData<BridgeDetails>(qk.bridges.detail(id));
      const optimistic: Partial<BridgeSummary> = {};
      if (body.name !== undefined) optimistic.name = body.name;
      if (body.redactedFields !== undefined) optimistic.redactedFields = body.redactedFields;
      if (body.scope !== undefined) optimistic.scope = body.scope;
      patchCaches(qc, id, optimistic);
      return { list, detail };
    },
    onError: (e, { id }, ctx) => {
      if (ctx?.list) qc.setQueryData(qk.bridges.list, ctx.list);
      if (ctx?.detail) qc.setQueryData(qk.bridges.detail(id), ctx.detail);
      toast.error(errorMessage(e, "Couldn't save that change."));
    },
    onSuccess: (_d, { successMessage }) => {
      if (successMessage) toast.success(successMessage);
    },
    onSettled: (_d, _e, { id }) => {
      void qc.invalidateQueries({ queryKey: qk.bridges.list });
      void qc.invalidateQueries({ queryKey: qk.bridges.detail(id) });
    },
  });
}

/** POST /connections/:id/refresh. The bridge flips to "scanning" and the list polls. */
export function useRefreshBridge() {
  const qc = useQueryClient();
  return useMutation({
    meta: { silent: true },
    mutationFn: (id: string) => bridgesApi.refresh(id),
    onSuccess: (_d, id) => {
      patchCaches(qc, id, { status: "scanning" });
      toast("Refreshing the schema", { description: "This usually takes under a minute." });
    },
    onError: (e) => toast.error(errorMessage(e, "Couldn't refresh the schema.")),
    onSettled: (_d, _e, id) => {
      void qc.invalidateQueries({ queryKey: qk.bridges.list });
      void qc.invalidateQueries({ queryKey: qk.bridges.detail(id) });
    },
  });
}

/** DELETE /connections/:id, removed optimistically and restored on failure. */
export function useDeleteBridge() {
  const qc = useQueryClient();
  return useMutation({
    meta: { silent: true },
    mutationFn: (b: Pick<BridgeSummary, "id" | "name">) => bridgesApi.remove(b.id),
    onMutate: async (b) => {
      await qc.cancelQueries({ queryKey: qk.bridges.list });
      const prev = qc.getQueryData<BridgeSummary[]>(qk.bridges.list);
      qc.setQueryData<BridgeSummary[]>(qk.bridges.list, (old) => old?.filter((x) => x.id !== b.id));
      return { prev };
    },
    onError: (e, b, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.bridges.list, ctx.prev);
      toast.error(`Couldn't delete ${b.name}`, { description: errorMessage(e) });
    },
    onSuccess: (_d, b) => {
      qc.removeQueries({ queryKey: qk.bridges.detail(b.id) });
      toast.success(`${b.name} deleted`);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.bridges.list });
      void qc.invalidateQueries({ queryKey: qk.usage });
    },
  });
}

/** POST /connections/sample: adds the sample dataset. */
export function useCreateSampleBridge() {
  const qc = useQueryClient();
  return useMutation({
    meta: { silent: true },
    mutationFn: () => bridgesApi.sample(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.bridges.all });
      void qc.invalidateQueries({ queryKey: qk.usage });
    },
  });
}
