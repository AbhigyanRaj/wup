"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, Database, RefreshCw, Trash2, Loader2, AlertCircle, ChevronDown,
  EyeOff, Eye, Sparkles, Check, Pencil,
} from "lucide-react";
import { bridgesApi, waitForScan, formatCount, type BridgeDetails, type ScopeEntry } from "@/lib/bridges";

interface BridgeDetailsDrawerProps {
  bridgeId: string | null;
  onClose: () => void;
  onChanged: () => void;
  onDeleted: (id: string) => void;
  onAsk: (question: string) => void;
}

const timeAgo = (iso: string | null) => {
  if (!iso) return "never";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export function BridgeDetailsDrawer({ bridgeId, onClose, onChanged, onDeleted, onAsk }: BridgeDetailsDrawerProps) {
  const [bridge, setBridge] = useState<BridgeDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = async (id: string) => {
    try {
      const b = await bridgesApi.get(id);
      setBridge(b);
      setName(b.name);
      if (b.status === "scanning") {
        const done = await waitForScan(id, setBridge);
        setBridge(done);
        onChanged();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load bridge.");
    }
  };

  useEffect(() => {
    setBridge(null);
    setError(null);
    setEditingName(false);
    setConfirmDelete(false);
    setOpen(new Set());
    if (bridgeId) load(bridgeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridgeId]);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  const saveName = () =>
    run("name", async () => {
      if (!bridge || !name.trim() || name.trim() === bridge.name) {
        setEditingName(false);
        return;
      }
      await bridgesApi.update(bridge._id, { name: name.trim() });
      setBridge({ ...bridge, name: name.trim() });
      setEditingName(false);
      onChanged();
    });

  const refresh = () =>
    run("refresh", async () => {
      if (!bridge) return;
      await bridgesApi.refresh(bridge._id);
      setBridge({ ...bridge, status: "scanning" });
      const done = await waitForScan(bridge._id, setBridge);
      setBridge(done);
      onChanged();
    });

  const toggleField = (key: string, path: string) =>
    run(`field:${key}.${path}`, async () => {
      if (!bridge) return;
      const current = new Set(bridge.redactedFields[key] ?? []);
      if (current.has(path)) current.delete(path);
      else current.add(path);
      const redactedFields = { ...bridge.redactedFields, [key]: [...current] };
      await bridgesApi.update(bridge._id, { redactedFields });
      setBridge({ ...bridge, redactedFields });
    });

  /** Removes one collection from the scope and re-scans. */
  const removeCollection = (db: string, coll: string) =>
    run(`scope:${db}.${coll}`, async () => {
      if (!bridge) return;
      const dbColls = bridge.schema.find((d) => d.name === db)?.collections.map((c) => c.name) ?? [];
      const base: ScopeEntry[] = bridge.scope.length
        ? bridge.scope
        : bridge.schema.map((d) => ({ db: d.name, collections: ["*"] }));
      const scope = base
        .map((s) => {
          if (s.db !== db) return s;
          const list = s.collections.includes("*") ? dbColls : s.collections;
          return { db, collections: list.filter((c) => c !== coll) };
        })
        .filter((s) => s.collections.length > 0);
      await bridgesApi.update(bridge._id, { scope });
      await load(bridge._id);
      onChanged();
    });

  const remove = () =>
    run("delete", async () => {
      if (!bridge) return;
      await bridgesApi.remove(bridge._id);
      onDeleted(bridge._id);
      onClose();
    });

  const totalDocs = useMemo(
    () => bridge?.schema.reduce((n, d) => n + d.collections.reduce((m, c) => m + (c.count || 0), 0), 0) ?? 0,
    [bridge]
  );

  return (
    <AnimatePresence>
      {bridgeId && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[90]"
            style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(2px)" }}
          />
          <motion.aside
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            className="fixed right-0 top-0 bottom-0 z-[91] w-full max-w-md flex flex-col border-l"
            style={{ background: "var(--bg-overlay)", borderColor: "var(--border)" }}
          >
            {/* Header */}
            <div className="flex items-start gap-3 px-5 py-4 border-b border-[var(--border)]">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--bg-highlight)] text-[var(--text-muted)] shrink-0">
                <Database size={16} />
              </div>
              <div className="flex-1 min-w-0">
                {editingName ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      autoFocus
                      value={name}
                      maxLength={80}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
                      className="flex-1 min-w-0 bg-[var(--bg-highlight)] border border-[var(--border)] rounded-lg px-2 py-1 text-[13px] text-[var(--text-primary)] outline-none"
                    />
                    <button onClick={saveName} className="p-1.5 rounded-md hover:bg-[var(--bg-highlight)] text-[var(--green)] cursor-pointer"><Check size={14} /></button>
                  </div>
                ) : (
                  <button onClick={() => setEditingName(true)} className="group flex items-center gap-1.5 max-w-full cursor-pointer">
                    <span className="text-[14px] font-semibold text-[var(--text-primary)] truncate">{bridge?.name ?? "Loading…"}</span>
                    <Pencil size={11} className="opacity-0 group-hover:opacity-60 text-[var(--text-muted)] shrink-0" />
                  </button>
                )}
                {bridge && (
                  <p className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] mt-0.5">
                    <StatusDot status={bridge.status} />
                    {bridge.status === "scanning" ? "Scanning schema…" : bridge.status === "error" ? "Needs attention" : "Active"}
                    <span className="opacity-50">·</span>
                    scanned {timeAgo(bridge.lastScannedAt)}
                  </p>
                )}
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">
                <X size={15} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide p-5 space-y-6">
              {!bridge && !error && (
                <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-[var(--text-muted)]" /></div>
              )}

              {error && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl border border-red-500/20 bg-red-500/5">
                  <AlertCircle size={14} className="shrink-0 mt-0.5 text-[var(--red)]" />
                  <p className="text-[12px] text-[var(--red)]">{error}</p>
                </div>
              )}

              {bridge && (
                <>
                  {bridge.status === "error" && bridge.lastError && (
                    <div className="flex items-start gap-2.5 p-3 rounded-xl border border-red-500/20 bg-red-500/5">
                      <AlertCircle size={14} className="shrink-0 mt-0.5 text-[var(--red)]" />
                      <p className="text-[12px] leading-relaxed text-[var(--red)]">{bridge.lastError}</p>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      ["Databases", bridge.stats.databases.toLocaleString("en-US")],
                      ["Collections", bridge.stats.collections.toLocaleString("en-US")],
                      ["Documents", totalDocs.toLocaleString("en-US")],
                    ].map(([label, value]) => (
                      <div key={label} className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-raised)]">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</p>
                        <p className="text-[16px] font-semibold tabular-nums text-[var(--text-primary)] mt-0.5">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Suggestions */}
                  {bridge.suggestions.length > 0 && (
                    <section className="space-y-2">
                      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]">
                        <Sparkles size={11} /> Try asking
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {bridge.suggestions.map((q) => (
                          <button
                            key={q}
                            onClick={() => { onAsk(q); onClose(); }}
                            className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--orange)]/30 transition-all cursor-pointer text-left"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Schema */}
                  <section className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]">What WUUP can read</p>
                      <p className="text-[10.5px] text-[var(--text-muted)]">Click a field to hide or show it</p>
                    </div>
                    {bridge.schema.length === 0 && bridge.status !== "scanning" && (
                      <p className="text-[12px] text-[var(--text-muted)]">No collections scanned yet. Try refreshing the schema.</p>
                    )}
                    <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden">
                      {bridge.schema.flatMap((db) =>
                        db.collections.map((c) => {
                          const key = `${db.name}.${c.name}`;
                          const isOpen = open.has(key);
                          const hiddenSet = new Set(bridge.redactedFields[key] ?? []);
                          return (
                            <div key={key}>
                              <button
                                onClick={() => setOpen((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(key)) next.delete(key); else next.add(key);
                                  return next;
                                })}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-[var(--bg-highlight)]/40 cursor-pointer"
                              >
                                <span className="font-mono text-[12px] text-[var(--text-muted)]">{db.name}.</span>
                                <span className="font-mono text-[12.5px] text-[var(--text-primary)] -ml-2 truncate">{c.name}</span>
                                {hiddenSet.size > 0 && (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-[var(--red)] opacity-80">
                                    <EyeOff size={10} />{hiddenSet.size}
                                  </span>
                                )}
                                <span className="ml-auto text-[11px] tabular-nums text-[var(--text-muted)]">{formatCount(c.count)}</span>
                                <ChevronDown size={13} className={`text-[var(--text-muted)] transition-transform ${isOpen ? "rotate-180" : ""}`} />
                              </button>
                              {isOpen && (
                                <div className="px-3 pb-3 space-y-2.5">
                                  <div className="flex flex-wrap gap-1.5">
                                    {c.fields.filter((f) => f.path !== "_id").map((f) => {
                                      const isHidden = hiddenSet.has(f.path);
                                      const pending = busy === `field:${key}.${f.path}`;
                                      return (
                                        <button
                                          key={f.path}
                                          disabled={!!busy}
                                          onClick={() => toggleField(key, f.path)}
                                          title={`${f.types.join(" | ")} · in ${f.pct}% of sampled documents`}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono border transition-all cursor-pointer disabled:cursor-wait"
                                          style={{
                                            borderColor: isHidden ? "rgba(248,113,113,0.3)" : "var(--border)",
                                            background: isHidden ? "rgba(248,113,113,0.08)" : "transparent",
                                            color: isHidden ? "var(--red)" : "var(--text-secondary)",
                                            textDecoration: isHidden ? "line-through" : "none",
                                          }}
                                        >
                                          {pending ? <Loader2 size={10} className="animate-spin" /> : isHidden ? <EyeOff size={10} /> : <Eye size={10} className="opacity-40" />}
                                          {f.path}
                                          <span className="opacity-40 no-underline">{f.types[0]}</span>
                                        </button>
                                      );
                                    })}
                                    {c.fields.length === 0 && <span className="text-[11px] text-[var(--text-muted)]">No fields sampled (empty collection or view).</span>}
                                  </div>
                                  <button
                                    disabled={!!busy}
                                    onClick={() => removeCollection(db.name, c.name)}
                                    className="text-[11px] text-[var(--text-muted)] hover:text-[var(--red)] transition-colors cursor-pointer"
                                  >
                                    {busy === `scope:${key}` ? "Removing…" : "Stop sharing this collection"}
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </section>
                </>
              )}
            </div>

            {/* Footer */}
            {bridge && (
              <div className="flex items-center gap-2 px-5 py-4 border-t border-[var(--border)]">
                <button
                  onClick={refresh}
                  disabled={!!busy || bridge.status === "scanning"}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[var(--border)] text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50 transition-all cursor-pointer"
                >
                  <RefreshCw size={13} className={bridge.status === "scanning" || busy === "refresh" ? "animate-spin" : ""} />
                  Refresh schema
                </button>
                <div className="flex-1" />
                {confirmDelete ? (
                  <>
                    <button onClick={() => setConfirmDelete(false)} className="px-3 py-2 text-[12px] text-[var(--text-muted)] cursor-pointer">Cancel</button>
                    <button
                      onClick={remove}
                      disabled={!!busy}
                      className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-semibold text-white bg-red-500/90 hover:bg-red-500 transition-all cursor-pointer"
                    >
                      {busy === "delete" ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      Delete bridge
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] text-[var(--text-muted)] hover:text-[var(--red)] transition-all cursor-pointer"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                )}
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export function StatusDot({ status }: { status: string }) {
  if (status === "scanning") return <Loader2 size={10} className="animate-spin shrink-0" style={{ color: "var(--amber)" }} />;
  if (status === "error") return <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--red)" }} />;
  return <div className="w-1.5 h-1.5 rounded-full shrink-0 shadow-[0_0_8px_rgba(74,222,128,0.4)]" style={{ background: "var(--green)" }} />;
}
