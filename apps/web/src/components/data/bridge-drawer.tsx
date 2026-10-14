"use client";

import { useState } from "react";
import { Check, ChevronDown, EyeOff, Lock, Pencil, RefreshCw, Table2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Drawer } from "@/components/ui/drawer";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { StatRow, StatRows } from "@/components/ui/stat-row";
import { cn } from "@/lib/cn";
import {
  canRefresh,
  formatCount,
  scopeWithout,
  toggleRedaction,
  totalDocuments,
  type BridgeDetails,
  type BridgeSummary,
} from "@/lib/bridges";
import { useBridge, useRefreshBridge, useUpdateBridge } from "@/hooks/data/useBridges";
import { DeleteBridgeDialog, SampleBadge } from "./bridges-table";
import { RedactChip } from "./mongo-steps";
import { BridgeStatusPill, ErrorCallout, SectionLabel, timeAgo, TryAsking, TYPE_LABEL } from "./parts";

function NameEditor({ bridge }: { bridge: BridgeSummary }) {
  const update = useUpdateBridge();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(bridge.name);

  if (bridge.isSystem) return <span className="block truncate">{bridge.name}</span>;

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setName(bridge.name);
          setEditing(true);
        }}
        className="group -ml-1.5 flex max-w-full items-center gap-2 rounded-lg px-1.5 py-0.5 text-left hover:bg-sf-secondary focus-visible:outline-2 focus-visible:outline-indigo-400"
        aria-label={`Rename ${bridge.name}`}
      >
        <span className="truncate">{bridge.name}</span>
        <Pencil className="size-3.5 shrink-0 text-tx-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" strokeWidth={1.5} aria-hidden="true" />
      </button>
    );
  }

  const save = () => {
    const n = name.trim();
    if (n && n !== bridge.name) update.mutate({ id: bridge.id, body: { name: n } });
    setEditing(false);
  };

  return (
    <span className="flex items-center gap-1">
      <input
        autoFocus
        value={name}
        maxLength={80}
        aria-label="Source name"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") {
            e.stopPropagation();
            setEditing(false);
          }
        }}
        className="min-w-0 flex-1 rounded-lg border border-indigo-300 bg-sf-white px-2 py-0.5 text-[20px] font-medium tracking-[-0.015em] text-tx shadow-focus outline-none"
      />
      <button type="button" onClick={save} aria-label="Save name" className="grid size-8 place-items-center rounded-full text-green-600 hover:bg-green-50">
        <Check className="size-4" strokeWidth={2} />
      </button>
      <button type="button" onClick={() => setEditing(false)} aria-label="Cancel rename" className="grid size-8 place-items-center rounded-full text-tx-tertiary hover:bg-sf-secondary">
        <X className="size-4" strokeWidth={1.5} />
      </button>
    </span>
  );
}

function CollectionRow({
  bridge,
  db,
  coll,
  open,
  onToggle,
  onStopSharing,
}: {
  bridge: BridgeDetails;
  db: string;
  coll: BridgeDetails["schema"][number]["collections"][number];
  open: boolean;
  onToggle: () => void;
  onStopSharing: () => void;
}) {
  const update = useUpdateBridge();
  const key = `${db}.${coll.name}`;
  const hidden = new Set(bridge.redactedFields[key] ?? []);
  const readOnly = bridge.isSystem;
  const panelId = `coll-${key.replace(/[^a-z0-9]/gi, "-")}`;
  const fields = coll.fields.filter((f) => f.path !== "_id");

  return (
    <div className="border-t border-st-secondary first:border-t-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className={cn(
          "flex min-h-12 w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-sf-secondary/60",
          "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-400",
        )}
      >
        <Table2 className={cn("size-4 shrink-0", open ? "text-indigo-800" : "text-tx-tertiary")} strokeWidth={1.5} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate font-mono text-[13px]">
          <span className="text-tx-muted">{db}.</span>
          <span className={open ? "text-indigo-800" : "text-tx"}>{coll.name}</span>
        </span>
        {hidden.size > 0 ? (
          <span className="inline-flex items-center gap-1 text-[12px] text-red-400" title={`${hidden.size} hidden`}>
            <EyeOff className="size-3" strokeWidth={1.5} aria-hidden="true" />
            {hidden.size}
          </span>
        ) : null}
        <span className="text-[12px] tabular-nums text-tx-tertiary">{formatCount(coll.count)}</span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-tx-tertiary transition-transform duration-200 ease-standard", open && "rotate-180 text-indigo-800")}
          strokeWidth={1.5}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div id={panelId} className="border-t border-st-secondary bg-sf-secondary/40 px-4 py-3.5">
          {fields.length ? (
            <div className="flex flex-wrap gap-1.5">
              {fields.map((f) => (
                <RedactChip
                  key={f.path}
                  field={f.path}
                  meta={f.types[0]}
                  hidden={hidden.has(f.path)}
                  disabled={readOnly}
                  title={`${f.types.join(" | ")}, in ${Math.round(f.pct)}% of sampled documents`}
                  onToggle={() =>
                    update.mutate({
                      id: bridge.id,
                      body: { redactedFields: toggleRedaction(bridge.redactedFields, key, f.path) },
                    })
                  }
                />
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-tx-tertiary">No fields sampled (an empty collection or a view).</p>
          )}
          {!readOnly ? (
            <button
              type="button"
              onClick={onStopSharing}
              className="mt-3 rounded text-[13px] text-tx-tertiary underline decoration-st underline-offset-4 transition-colors hover:text-red-400 hover:decoration-red-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
            >
              Stop sharing this collection
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SheetsSchema({ bridge }: { bridge: BridgeDetails }) {
  const tabs = bridge.sheets?.tabs ?? [];
  if (!tabs.length) return <p className="text-[14px] text-tx-tertiary">No tabs read yet. Try refreshing.</p>;
  return (
    <div className="overflow-hidden rounded-2xl border border-st-secondary bg-sf-white">
      {tabs.map((t) => (
        <div key={t.name} className="border-t border-st-secondary px-4 py-3 first:border-t-0">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-[14px] font-medium text-tx">{t.name}</p>
            <p className="shrink-0 text-[12px] tabular-nums text-tx-tertiary">
              {t.rows.toLocaleString("en-US")} rows, {t.cols} cols
            </p>
          </div>
          {t.headers.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {t.headers.map((h, i) => (
                <span key={`${h}-${i}`} className="rounded-md border border-st bg-sf-white px-2 py-0.5 font-mono text-[12px] text-tx-secondary">
                  {h || `column ${i + 1}`}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function BridgeDrawer({
  bridgeId,
  summary,
  onClose,
}: {
  bridgeId: string | null;
  summary?: BridgeSummary | null;
  onClose: () => void;
}) {
  const q = useBridge(bridgeId);
  const refresh = useRefreshBridge();
  const update = useUpdateBridge();
  const bridge = q.data;
  const head: BridgeSummary | undefined = bridge ?? summary ?? undefined;
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const [stopSharing, setStopSharing] = useState<{ db: string; coll: string } | null>(null);
  const [deleting, setDeleting] = useState<BridgeSummary | null>(null);

  const toggle = (k: string) => setOpenKeys((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  const isSheets = head?.type === "sheets";

  return (
    <>
      <Drawer
        open={!!bridgeId}
        onOpenChange={(o) => !o && onClose()}
        width={480}
        title={head ? <NameEditor key={head.id} bridge={head} /> : "Loading"}
        description={
          head ? (
            <span className="mt-1 flex flex-wrap items-center gap-2">
              <BridgeStatusPill status={head.status} />
              <span className="text-[13px] text-tx-tertiary">
                {TYPE_LABEL[head.type] ?? head.type}
                <span aria-hidden="true"> · </span>
                {head.status === "scanning" ? "Scanning now" : `Scanned ${timeAgo(head.lastScannedAt, "never").toLowerCase()}`}
              </span>
              {head.isSystem ? <SampleBadge /> : null}
            </span>
          ) : undefined
        }
        footer={
          head && !head.isSystem ? (
            <>
              {canRefresh(head) ? (
                <Button
                  variant="soft"
                  className="sm:mr-auto"
                  leadingIcon={<RefreshCw className={cn("size-4", head.status === "scanning" && "animate-spin")} strokeWidth={1.5} aria-hidden="true" />}
                  disabled={head.status === "scanning" || refresh.isPending}
                  onClick={() => refresh.mutate(head.id)}
                >
                  {head.status === "scanning" ? "Scanning" : "Refresh schema"}
                </Button>
              ) : null}
              <Button
                variant="ghost"
                className="text-red-400! hover:bg-red-50!"
                leadingIcon={<Trash2 className="size-4" strokeWidth={1.5} aria-hidden="true" />}
                onClick={() => setDeleting(head)}
              >
                Delete
              </Button>
            </>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-7" data-testid="bridge-drawer">
          {q.isError && !bridge ? <ErrorCallout error={{ title: "Couldn't load this source", message: String(q.error?.message ?? "") }} /> : null}

          {head?.isSystem ? (
            <div className="flex items-start gap-3 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-[14px] text-tx-secondary">
              <Lock className="mt-0.5 size-4 shrink-0 text-sky-700" strokeWidth={1.5} aria-hidden="true" />
              Sample data is read-only. Connect your own database to choose collections and hide fields.
            </div>
          ) : null}

          {bridge?.status === "error" && bridge.lastError ? (
            <ErrorCallout error={{ title: "The last scan failed", message: bridge.lastError, hint: "Check the connection, then refresh the schema." }} />
          ) : null}

          {!bridge ? (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-28 w-full" shape="block" />
              <SkeletonText lines={4} />
            </div>
          ) : (
            <>
              <StatRows>
                {isSheets ? (
                  <>
                    <StatRow label="Tabs" value={(bridge.sheets?.tabs.length ?? bridge.stats.collections).toLocaleString("en-US")} />
                    <StatRow
                      label="Rows"
                      value={(bridge.sheets?.tabs.reduce((n, t) => n + t.rows, 0) ?? 0).toLocaleString("en-US")}
                    />
                  </>
                ) : (
                  <>
                    <StatRow label="Databases" value={bridge.stats.databases.toLocaleString("en-US")} />
                    <StatRow label="Collections" value={bridge.stats.collections.toLocaleString("en-US")} />
                    <StatRow label="Documents" value={totalDocuments(bridge).toLocaleString("en-US")} />
                  </>
                )}
              </StatRows>

              <TryAsking suggestions={bridge.suggestions.slice(0, 4)} onNavigate={onClose} />

              <section className="flex flex-col gap-3" aria-label="Schema">
                <div className="flex items-baseline justify-between gap-3">
                  <SectionLabel>{isSheets ? "Tabs and headers" : "What wuup can read"}</SectionLabel>
                  {!isSheets && !bridge.isSystem ? (
                    <span className="text-[12px] text-tx-tertiary">Click a field to hide it</span>
                  ) : null}
                </div>
                {isSheets ? (
                  <SheetsSchema bridge={bridge} />
                ) : bridge.schema.length === 0 ? (
                  <p className="text-[14px] text-tx-tertiary">
                    {bridge.status === "scanning" ? "Sampling collections..." : "No collections scanned yet. Try refreshing the schema."}
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-st-secondary bg-sf-white">
                    {bridge.schema.flatMap((d) =>
                      d.collections.map((c) => {
                        const k = `${d.db}.${c.name}`;
                        return (
                          <CollectionRow
                            key={k}
                            bridge={bridge}
                            db={d.db}
                            coll={c}
                            open={openKeys.includes(k)}
                            onToggle={() => toggle(k)}
                            onStopSharing={() => setStopSharing({ db: d.db, coll: c.name })}
                          />
                        );
                      }),
                    )}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </Drawer>

      <ConfirmDialog
        open={!!stopSharing}
        onOpenChange={(o) => !o && setStopSharing(null)}
        tone="danger"
        title={`Stop sharing ${stopSharing?.coll ?? "this collection"}?`}
        body="wuup won't read this collection any more, and the schema is re-scanned. You can add it back by connecting again."
        confirmLabel="Stop sharing"
        onConfirm={async () => {
          if (!bridge || !stopSharing) return;
          try {
            await update.mutateAsync({
              id: bridge.id,
              body: { scope: scopeWithout(bridge, stopSharing.db, stopSharing.coll) },
              successMessage: `${stopSharing.coll} is no longer shared`,
            });
          } catch {
            /* the mutation already showed a toast and rolled back */
          }
        }}
      />
      <DeleteBridgeDialog bridge={deleting} onOpenChange={(o) => !o && setDeleting(null)} onDeleted={onClose} />
    </>
  );
}
