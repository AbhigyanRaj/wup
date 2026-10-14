"use client";

import { useState } from "react";
import { FileText, MoreHorizontal, RotateCw, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from "@/components/ui/menu";
import { Pill } from "@/components/ui/pill";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { TableShell, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table-shell";
import { failureMessage, formatBytes, phaseFor, type KnowledgeSourceDTO } from "@/lib/knowledge";
import { useDeleteKnowledge, useRetryKnowledge } from "@/hooks/data/useKnowledge";
import { formatDate } from "./parts";

const TYPE_TINT: Record<string, string> = {
  pdf: "bg-red-50 text-red-400",
  txt: "bg-sf-secondary text-tx-tertiary",
  md: "bg-indigo-50 text-indigo-600",
  csv: "bg-green-50 text-green-700",
  docx: "bg-blue-50 text-blue-600",
};

function DocIcon({ type }: { type: string }) {
  return (
    <span
      aria-hidden="true"
      className={`relative grid size-8 shrink-0 place-items-center rounded-[10px] ${TYPE_TINT[type] ?? TYPE_TINT.txt}`}
    >
      <FileText className="size-4" strokeWidth={1.5} />
    </span>
  );
}

function StatusCell({ s }: { s: KnowledgeSourceDTO }) {
  const retry = useRetryKnowledge();
  const phase = phaseFor(s.status);
  if (phase === "ready") {
    return (
      <Pill tone="success" dot>
        Ready
      </Pill>
    );
  }
  if (phase === "failed") {
    return (
      <div className="flex flex-wrap items-center gap-2 max-sm:justify-end">
        <Pill tone="error" dot title={failureMessage(s)}>
          Failed
        </Pill>
        {s.canRetry ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              retry.mutate({ id: s.id, name: s.name });
            }}
            disabled={retry.isPending}
            className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[13px] font-medium text-indigo-800 transition-colors hover:bg-indigo-50 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
            data-testid="retry-doc"
          >
            <RotateCw className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
            Retry
          </button>
        ) : null}
      </div>
    );
  }
  const p = s.progress;
  const label = p && p.total > 0 ? `Indexing ${p.done.toLocaleString("en-US")} of ${p.total.toLocaleString("en-US")}` : s.status === "pending" ? "Queued" : "Indexing";
  return (
    <div className="flex w-36 flex-col gap-1.5 max-sm:items-end" data-testid="doc-indexing">
      <span className="inline-flex items-center gap-1.5 text-[13px] tabular-nums text-blue-700">
        <span className="size-1.5 animate-pulse rounded-full bg-blue-600 motion-reduce:animate-none" aria-hidden="true" />
        {label}
      </span>
      <Progress
        value={p && p.total > 0 ? (p.done / p.total) * 100 : null}
        className="w-full"
        aria-label={`Indexing ${s.name}`}
      />
    </div>
  );
}

export function DocumentsTable({ docs, loading }: { docs: KnowledgeSourceDTO[]; loading?: boolean }) {
  const [deleting, setDeleting] = useState<KnowledgeSourceDTO | null>(null);
  const del = useDeleteKnowledge();

  return (
    <>
      <TableShell stacked caption="Documents" data-testid="documents-table">
        <Thead>
          <tr role="row">
            <Th className="w-[40%]">Name</Th>
            <Th>Status</Th>
            <Th numeric>Chunks</Th>
            <Th numeric>Size</Th>
            <Th>Added</Th>
            <Th className="w-14">
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </Thead>
        <Tbody>
          {loading
            ? Array.from({ length: 3 }, (_, i) => (
                <Tr key={i}>
                  <Td primary>
                    <div className="flex items-center gap-3">
                      <Skeleton className="size-8 rounded-[10px]" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                  </Td>
                  {Array.from({ length: 4 }, (_, j) => (
                    <Td key={j} className="max-sm:hidden">
                      <Skeleton className="h-4 w-14" />
                    </Td>
                  ))}
                  <Td className="max-sm:hidden" />
                </Tr>
              ))
            : docs.map((s) => (
                <Tr key={s.id} className="relative" data-testid="doc-row" data-status={s.status}>
                  <Td primary label="Name" className="py-3.5 max-sm:pr-10">
                    <div className="flex w-full min-w-0 items-center gap-3 text-left">
                      <DocIcon type={s.type} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium text-tx" title={s.name}>
                          {s.name}
                        </p>
                        {phaseFor(s.status) === "failed" ? (
                          <p className="max-w-[360px] truncate text-[13px] text-red-400" title={failureMessage(s)}>
                            {failureMessage(s)}
                          </p>
                        ) : s.truncated ? (
                          <p className="text-[13px] text-yellow-700">Partly indexed: your chunk limit was reached</p>
                        ) : (
                          <p className="text-[13px] uppercase tracking-[0.04em] text-tx-muted">{s.type}</p>
                        )}
                      </div>
                    </div>
                  </Td>
                  <Td label="Status">
                    <StatusCell s={s} />
                  </Td>
                  <Td label="Chunks" numeric muted>
                    {phaseFor(s.status) === "ready" ? s.chunkCount.toLocaleString("en-US") : "-"}
                  </Td>
                  <Td label="Size" numeric muted className="whitespace-nowrap">
                    {formatBytes(s.fileSize)}
                  </Td>
                  <Td label="Added" muted className="whitespace-nowrap">
                    {formatDate(s.createdAt)}
                  </Td>
                  <Td className="text-right max-sm:absolute max-sm:right-3 max-sm:top-3 max-sm:p-0">
                    <MenuRoot>
                      <MenuTrigger asChild>
                        <IconButton aria-label={`Actions for ${s.name}`} size="sm" data-testid="row-menu">
                          <MoreHorizontal />
                        </IconButton>
                      </MenuTrigger>
                      <MenuContent align="end">
                        <MenuItem icon={<Trash2 />} tone="danger" onSelect={() => setDeleting(s)}>
                          Delete
                        </MenuItem>
                      </MenuContent>
                    </MenuRoot>
                  </Td>
                </Tr>
              ))}
        </Tbody>
      </TableShell>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        tone="danger"
        title={`Delete ${deleting?.name ?? "this document"}?`}
        body="The file and its indexed chunks are removed from your knowledge base. wuup can no longer answer from it. This can't be undone."
        confirmLabel="Delete document"
        onConfirm={() => {
          if (deleting) del.mutate({ id: deleting.id, name: deleting.name });
        }}
      />
    </>
  );
}
