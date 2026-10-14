"use client";

import { useState } from "react";
import { Database, FileSpreadsheet, MoreHorizontal, PanelRightOpen, Pencil, RefreshCw, Server, Trash2 } from "lucide-react";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Field, Input } from "@/components/ui/input";
import { MenuContent, MenuItem, MenuRoot, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Skeleton } from "@/components/ui/skeleton";
import { TableShell, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table-shell";
import { cn } from "@/lib/cn";
import { canRefresh, scopeLabel, type BridgeSummary } from "@/lib/bridges";
import { useDeleteBridge, useRefreshBridge, useUpdateBridge } from "@/hooks/data/useBridges";
import { BridgeStatusPill, timeAgo, TYPE_LABEL } from "./parts";

export function BridgeIcon({ type, size = "md" }: { type: string; size?: "md" | "lg" }) {
  const Icon = type === "sheets" ? FileSpreadsheet : type === "mongodb" ? Database : Server;
  const bg =
    type === "sheets"
      ? "linear-gradient(160deg, #6ea335 0%, #c6e3a0 100%)"
      : type === "mongodb"
        ? "linear-gradient(160deg, #5b8def 0%, #a5d8fb 100%)"
        : "linear-gradient(160deg, #cfd3dc 0%, #f0f1f5 100%)";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]",
        size === "lg" ? "size-11 rounded-xl" : "size-8 rounded-[10px]",
      )}
      style={{ background: bg }}
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.5),transparent_65%)]" />
      <Icon className={cn("relative", size === "lg" ? "size-5" : "size-4")} strokeWidth={1.75} />
    </span>
  );
}

export function SampleBadge() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-sky-50 px-2 py-px text-[12px] font-medium text-sky-700 shadow-[inset_0_0_0_1px_var(--sky-100)]">
      Sample data
    </span>
  );
}

export function RenameDialog({
  bridge,
  onOpenChange,
}: {
  bridge: BridgeSummary | null;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useUpdateBridge();
  const [name, setName] = useState(bridge?.name ?? "");
  const [lastId, setLastId] = useState(bridge?.id);
  if (bridge?.id !== lastId) {
    setLastId(bridge?.id);
    setName(bridge?.name ?? "");
  }
  const submit = () => {
    const n = name.trim();
    if (!bridge || !n) return;
    if (n !== bridge.name) update.mutate({ id: bridge.id, body: { name: n }, successMessage: "Renamed" });
    onOpenChange(false);
  };
  return (
    <Dialog
      open={!!bridge}
      onOpenChange={onOpenChange}
      title="Rename source"
      size="sm"
      footer={
        <>
          <Button variant="soft" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="ink" onClick={submit} disabled={!name.trim()}>
            Save
          </Button>
        </>
      }
    >
      <Field label="Name">
        <Input
          value={name}
          maxLength={80}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
      </Field>
    </Dialog>
  );
}

export function DeleteBridgeDialog({
  bridge,
  onOpenChange,
  onDeleted,
}: {
  bridge: BridgeSummary | null;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const del = useDeleteBridge();
  return (
    <ConfirmDialog
      open={!!bridge}
      onOpenChange={onOpenChange}
      tone="danger"
      title={`Delete ${bridge?.name ?? "this source"}?`}
      body="wuup forgets the connection string, the scanned schema and your hidden fields. Your database itself is not touched."
      confirmLabel="Delete source"
      onConfirm={() => {
        if (!bridge) return;
        del.mutate({ id: bridge.id, name: bridge.name });
        onDeleted?.();
      }}
    />
  );
}

function RowMenu({
  bridge,
  onOpen,
  onRename,
  onDelete,
}: {
  bridge: BridgeSummary;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const refresh = useRefreshBridge();
  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <IconButton
          aria-label={`Actions for ${bridge.name}`}
          size="sm"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          data-testid="row-menu"
        >
          <MoreHorizontal />
        </IconButton>
      </MenuTrigger>
      <MenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <MenuItem icon={<PanelRightOpen />} onSelect={onOpen}>
          Open
        </MenuItem>
        {canRefresh(bridge) ? (
          <MenuItem
            icon={<RefreshCw />}
            disabled={bridge.status === "scanning"}
            onSelect={() => refresh.mutate(bridge.id)}
          >
            Refresh schema
          </MenuItem>
        ) : null}
        {!bridge.isSystem ? (
          <>
            <MenuItem icon={<Pencil />} onSelect={onRename}>
              Rename
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Trash2 />} tone="danger" onSelect={onDelete}>
              Delete
            </MenuItem>
          </>
        ) : null}
      </MenuContent>
    </MenuRoot>
  );
}

export function BridgesTable({
  bridges,
  loading,
  selectedId,
  onOpen,
}: {
  bridges: BridgeSummary[];
  loading?: boolean;
  selectedId?: string | null;
  onOpen: (id: string) => void;
}) {
  const [renaming, setRenaming] = useState<BridgeSummary | null>(null);
  const [deleting, setDeleting] = useState<BridgeSummary | null>(null);

  return (
    <>
      <TableShell stacked caption="Databases and sheets" data-testid="bridges-table">
        <Thead>
          <tr role="row">
            <Th className="w-[34%]">Name</Th>
            <Th>Type</Th>
            <Th>Status</Th>
            <Th>Scope</Th>
            <Th>Last scanned</Th>
            <Th>Last used</Th>
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
                      <Skeleton className="h-4 w-40" />
                    </div>
                  </Td>
                  {Array.from({ length: 5 }, (_, j) => (
                    <Td key={j} className="max-sm:hidden">
                      <Skeleton className="h-4 w-16" />
                    </Td>
                  ))}
                  <Td className="max-sm:hidden" />
                </Tr>
              ))
            : bridges.map((b) => (
                <Tr
                  key={b.id}
                  interactive
                  selected={selectedId === b.id}
                  onClick={() => onOpen(b.id)}
                  className="relative"
                  data-testid="bridge-row"
                >
                  <Td primary label="Name" className="py-3.5 max-sm:pr-10">
                    <div className="flex w-full min-w-0 items-center gap-3 text-left">
                      <BridgeIcon type={b.type} />
                      <div className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpen(b.id);
                            }}
                            className="min-w-0 truncate rounded text-left text-[15px] font-medium text-tx hover:text-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
                          >
                            {b.name}
                          </button>
                          {b.isSystem ? <SampleBadge /> : null}
                        </span>
                        {b.status === "error" && b.lastError ? (
                          <span className="mt-0.5 block max-w-[320px] truncate text-[13px] text-red-400">{b.lastError}</span>
                        ) : null}
                      </div>
                    </div>
                  </Td>
                  <Td label="Type" muted className="whitespace-nowrap">
                    {TYPE_LABEL[b.type] ?? b.type}
                  </Td>
                  <Td label="Status">
                    <BridgeStatusPill status={b.status} />
                  </Td>
                  <Td label="Scope" muted className="whitespace-nowrap">
                    {scopeLabel(b)}
                  </Td>
                  <Td label="Last scanned" muted className="whitespace-nowrap">
                    {b.status === "scanning" ? "Scanning now" : timeAgo(b.lastScannedAt)}
                  </Td>
                  <Td label="Last used" muted className="whitespace-nowrap">
                    {timeAgo(b.lastUsedAt)}
                  </Td>
                  <Td className="text-right max-sm:absolute max-sm:right-3 max-sm:top-3 max-sm:before:hidden max-sm:p-0">
                    <RowMenu
                      bridge={b}
                      onOpen={() => onOpen(b.id)}
                      onRename={() => setRenaming(b)}
                      onDelete={() => setDeleting(b)}
                    />
                  </Td>
                </Tr>
              ))}
        </Tbody>
      </TableShell>
      <RenameDialog bridge={renaming} onOpenChange={(o) => !o && setRenaming(null)} />
      <DeleteBridgeDialog bridge={deleting} onOpenChange={(o) => !o && setDeleting(null)} />
    </>
  );
}
