"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Database, Table2, Zap,
  ChevronRight, ChevronDown, Lock,
  CheckCircle2, Loader2, AlertCircle, EyeOff, Eye, ShieldCheck, Sparkles, Search
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import {
  API_URL, bridgesApi, waitForScan, suggestBridgeName, formatCount,
  type TestResult, type ScopeEntry, type RedactionMap, type BridgeDetails,
} from "@/lib/bridges";

interface ConnectDbModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called when a bridge is created (list should refresh). */
  onCreated?: () => void;
  /** Sends a suggested question to the chat. */
  onAsk?: (question: string) => void;
}

type Step =
  | "choice" | "method" | "manual" | "assistant" | "loading" | "success"
  | "m-url" | "m-pick" | "m-privacy" | "m-name" | "m-saving" | "m-ready";

const MONGO_STEPS: Step[] = ["m-url", "m-pick", "m-privacy", "m-name"];

/** Collections usually not worth exposing by default (auth sessions, internals). */
const DEFAULT_EXCLUDED = /^(sessions?|_|system\.|migrations?$|changelog)/i;

type Selection = Record<string, Set<string>>;

function defaultSelection(test: TestResult): Selection {
  const sel: Selection = {};
  for (const db of test.databases) {
    sel[db.name] = new Set(db.collections.filter((c) => !DEFAULT_EXCLUDED.test(c.name)).map((c) => c.name));
  }
  return sel;
}

/** Turns the picker selection into a bridge scope ("*" when a whole db is selected). */
function selectionToScope(test: TestResult, sel: Selection): ScopeEntry[] {
  const scope: ScopeEntry[] = [];
  for (const db of test.databases) {
    const chosen = sel[db.name];
    if (!chosen || chosen.size === 0) continue;
    const all = db.collections.length > 0 && chosen.size === db.collections.length;
    scope.push({ db: db.name, collections: all ? ["*"] : [...chosen].sort() });
  }
  return scope;
}

export function ConnectDbModal({ isOpen, onClose, onCreated, onAsk }: ConnectDbModalProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";

  const [step, setStep] = useState<Step>("choice");
  const [selectedSource, setSelectedSource] = useState<{ name: string, icon: any, type: string } | null>(null);
  const [manualUrl, setManualUrl] = useState("");

  // MongoDB wizard state
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<TestResult | null>(null);
  const [selection, setSelection] = useState<Selection>({});
  const [expandedDbs, setExpandedDbs] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [hidden, setHidden] = useState<RedactionMap>({});
  const [bridgeName, setBridgeName] = useState("");
  const [created, setCreated] = useState<BridgeDetails | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setStep("choice");
        setSelectedSource(null);
        setManualUrl("");
        setError(null);
        setTesting(false);
        setTest(null);
        setSelection({});
        setExpandedDbs(new Set());
        setFilter("");
        setHidden({});
        setBridgeName("");
        setCreated(null);
      }, 400);
    }
  }, [isOpen]);

  const sources = [
    { name: "MongoDB", type: "mongodb", icon: <Database size={16} />, description: "Test, pick collections, ask questions" },
    { name: "Google Sheets", type: "sheets", icon: <Table2 size={16} />, description: "Cloud Spreadsheet Picker" },
    { name: "Supabase", type: "supabase", icon: <Zap size={16} />, description: "Project & Table Selector" },
  ];

  const handleManualConnect = async () => {
    setStep("loading");
    const token = localStorage.getItem("wuup_token");
    try {
      const res = await fetch(`${API_URL}/connections`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: `${selectedSource?.name} (${new Date().toLocaleDateString()})`,
          type: selectedSource?.type,
          config: manualUrl
        })
      });
      if (res.ok) {
        onCreated?.();
        setStep("success");
        setTimeout(() => onClose(), 2000);
      } else {
        if (selectedSource?.type === "sheets") setStep("assistant");
        else setStep("choice");
      }
    } catch (err) {
      setStep("choice");
    }
  };

  // ── MongoDB wizard actions ──────────────────────────────────────────────────

  const runTest = async () => {
    setTesting(true);
    setError(null);
    try {
      const result = await bridgesApi.test(manualUrl.trim());
      setTest(result);
      const sel = defaultSelection(result);
      setSelection(sel);
      setExpandedDbs(new Set(result.databases.slice(0, 1).map((d) => d.name)));
      setHidden(result.sensitive);
      setBridgeName(suggestBridgeName(manualUrl));
      setStep("m-pick");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection test failed.");
    } finally {
      setTesting(false);
    }
  };

  const scope = useMemo(() => (test ? selectionToScope(test, selection) : []), [test, selection]);
  const selectedCount = Object.values(selection).reduce((n, s) => n + s.size, 0);

  /** Sensitive fields for the collections the user kept. */
  const privacyRows = useMemo(() => {
    if (!test) return [];
    return Object.entries(test.sensitive)
      .filter(([key]) => {
        const dot = key.indexOf(".");
        return selection[key.slice(0, dot)]?.has(key.slice(dot + 1));
      })
      .map(([key, fields]) => ({ key, fields }));
  }, [test, selection]);

  const toggleHidden = (key: string, field: string) => {
    setHidden((prev) => {
      const current = new Set(prev[key] ?? []);
      if (current.has(field)) current.delete(field);
      else current.add(field);
      return { ...prev, [key]: [...current] };
    });
  };

  const save = async () => {
    setStep("m-saving");
    setError(null);
    try {
      // Only send redactions for in-scope collections that the probe looked at
      const redactedFields: RedactionMap = {};
      for (const row of privacyRows) redactedFields[row.key] = hidden[row.key] ?? [];
      const { id } = await bridgesApi.create({
        name: bridgeName.trim() || suggestBridgeName(manualUrl),
        type: "mongodb",
        config: manualUrl.trim(),
        scope,
        redactedFields,
      });
      onCreated?.();
      const details = await waitForScan(id, setCreated);
      setCreated(details);
      onCreated?.();
      setStep("m-ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the bridge.");
      setStep("m-name");
    }
  };

  const toggleDb = (db: TestResult["databases"][number]) => {
    setSelection((prev) => {
      const current = prev[db.name] ?? new Set<string>();
      const allOn = current.size === db.collections.length;
      return { ...prev, [db.name]: allOn ? new Set() : new Set(db.collections.map((c) => c.name)) };
    });
  };

  const toggleCollection = (db: string, coll: string) => {
    setSelection((prev) => {
      const next = new Set(prev[db] ?? []);
      if (next.has(coll)) next.delete(coll);
      else next.add(coll);
      return { ...prev, [db]: next };
    });
  };

  const isMongoFlow = step.startsWith("m-");
  const mongoStepIndex = MONGO_STEPS.indexOf(step);

  const title: Record<Step, string> = {
    choice: "Data Source",
    method: "Select Method",
    manual: "Manual Connect",
    assistant: "Access Assistant",
    loading: "Connecting",
    success: "Success",
    "m-url": "Connect MongoDB",
    "m-pick": "Choose what WUUP can read",
    "m-privacy": "Hide sensitive fields",
    "m-name": "Name your bridge",
    "m-saving": "Learning your data",
    "m-ready": "Bridge ready",
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100]"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed z-[101] inset-0 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className={`w-full pointer-events-auto rounded-3xl overflow-hidden border transition-[max-width] duration-300 ${isMongoFlow ? "max-w-lg" : "max-w-sm"}`}
              style={{
                background: "var(--bg-overlay)",
                borderColor: "var(--border)",
                boxShadow: isLight ? "0 12px 30px rgba(0,0,0,0.06)" : "0 24px 50px -12px rgba(0,0,0,0.8)"
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                <div>
                  <p className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">{title[step]}</p>
                  <p className="text-[11px] mt-0.5 text-[var(--text-muted)]">
                    {mongoStepIndex >= 0
                      ? `Step ${mongoStepIndex + 1} of ${MONGO_STEPS.length}`
                      : selectedSource ? selectedSource.name : "Select a bridge to start"}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {mongoStepIndex >= 0 && (
                <div className="flex gap-1 px-5 pt-3">
                  {MONGO_STEPS.map((s, i) => (
                    <div
                      key={s}
                      className="h-[3px] flex-1 rounded-full transition-colors"
                      style={{ background: i <= mongoStepIndex ? "var(--orange)" : "var(--border)" }}
                    />
                  ))}
                </div>
              )}

              <div className={`p-4 overflow-y-auto scrollbar-hide ${isMongoFlow ? "max-h-[520px]" : "max-h-[400px]"}`}>
                {/* STEP: SOURCE CHOICE */}
                {step === "choice" && (
                  <div className="space-y-1">
                    {sources.map((source) => (
                      <button
                        key={source.name}
                        onClick={() => {
                          setSelectedSource(source);
                          setStep(source.type === "mongodb" ? "m-url" : "method");
                        }}
                        className="w-full flex items-center gap-3.5 p-3 rounded-xl hover:bg-[var(--bg-highlight)] transition-all group text-left cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors bg-[var(--bg-highlight)] text-[var(--text-muted)]">
                          {source.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-[13px] font-medium text-[var(--text-primary)] transition-colors">{source.name}</h3>
                          <p className="text-[11px] text-[var(--text-muted)] font-light truncate">{source.description}</p>
                        </div>
                        <ChevronRight size={14} className="text-[var(--text-muted)] group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    ))}
                  </div>
                )}

                {/* STEP: METHOD CHOICE (non-MongoDB sources) */}
                {step === "method" && (
                  <div className="space-y-3">
                    <button
                      onClick={() => setStep("manual")}
                      className="w-full flex items-center gap-4 p-4 rounded-xl border border-[var(--border)] hover:bg-[var(--bg-highlight)] transition-all group text-left cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-full bg-[var(--bg-highlight)] flex items-center justify-center text-[var(--text-muted)]">
                        <Lock size={18} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-[13px] font-medium text-[var(--text-primary)]">Manual Link</h3>
                        <p className="text-[11px] text-[var(--text-muted)]">Paste a direct connection URI.</p>
                      </div>
                    </button>

                    <button onClick={() => setStep("choice")} className="w-full text-center text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-all py-2 mt-2 cursor-pointer">
                      Back to sources
                    </button>
                  </div>
                )}

                {/* STEP: MANUAL INPUT (non-MongoDB sources) */}
                {step === "manual" && (
                  <div className="space-y-5">
                    <div className="space-y-2.5">
                      <p className="text-[11px] text-[var(--text-secondary)] px-1 leading-relaxed">
                        Enter the connection URL for your {selectedSource?.name}.
                      </p>
                      <input
                        autoFocus
                        type="text"
                        value={manualUrl}
                        onChange={(e) => setManualUrl(e.target.value)}
                        placeholder="Paste connection link here..."
                        className="w-full bg-[var(--bg-highlight)] border border-[var(--border)] rounded-xl py-3 px-4 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-white/20 transition-all outline-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setStep("method")}
                        className="px-4 py-2 border border-[var(--border)] rounded-xl text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-all cursor-pointer"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleManualConnect}
                        disabled={!manualUrl}
                        className="flex-1 py-2 bg-[var(--orange)] text-white rounded-xl font-semibold text-[12px] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                      >
                        Verify & Sync
                      </button>
                    </div>
                  </div>
                )}

                {/* ── MONGO 1: URL + test ──────────────────────────────────────────── */}
                {step === "m-url" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-medium text-[var(--text-secondary)] px-1">Connection string</label>
                      <input
                        autoFocus
                        type="password"
                        autoComplete="off"
                        spellCheck={false}
                        value={manualUrl}
                        onChange={(e) => { setManualUrl(e.target.value); setError(null); }}
                        onKeyDown={(e) => { if (e.key === "Enter" && manualUrl && !testing) runTest(); }}
                        placeholder="mongodb+srv://user:password@cluster0.xxxx.mongodb.net/"
                        className="w-full bg-[var(--bg-highlight)] border border-[var(--border)] rounded-xl py-3 px-4 text-[13px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)] placeholder:font-sans focus:border-[var(--orange)]/40 transition-all outline-none"
                      />
                      <p className="text-[11px] text-[var(--text-muted)] px-1 leading-relaxed">
                        In Atlas: <span className="text-[var(--text-secondary)]">Connect → Drivers</span>. A user with the <span className="text-[var(--text-secondary)]">read</span> role is enough. Your URL is encrypted at rest.
                      </p>
                    </div>

                    {error && <ErrorBox message={error} />}

                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[var(--bg-highlight)]/60 border border-[var(--border)]">
                      <ShieldCheck size={15} className="shrink-0 mt-0.5 text-[var(--green)]" />
                      <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                        WUUP only reads. Writes, <code>$out</code>, <code>$merge</code> and server-side JavaScript are blocked, and every query is capped at 100 rows and 10 seconds.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => { setStep("choice"); setError(null); }}
                        className="px-4 py-2 border border-[var(--border)] rounded-xl text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-all cursor-pointer"
                      >
                        Back
                      </button>
                      <button
                        onClick={runTest}
                        disabled={!manualUrl.trim() || testing}
                        className="flex-1 py-2 bg-[var(--orange)] text-white rounded-xl font-semibold text-[12px] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                      >
                        {testing ? <><Loader2 size={13} className="animate-spin" /> Testing connection…</> : "Test connection"}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── MONGO 2: pick databases / collections ───────────────────────── */}
                {step === "m-pick" && test && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-[12px] text-[var(--green)]">
                      <CheckCircle2 size={14} />
                      Connected. Found {test.databases.length} database{test.databases.length === 1 ? "" : "s"}.
                    </div>

                    {test.databases.length === 0 ? (
                      <p className="text-[12px] text-[var(--text-muted)] p-3">
                        This user can&apos;t see any databases. Give it the read role on the databases you want to use.
                      </p>
                    ) : (
                      <>
                        {test.databases.reduce((n, d) => n + d.collections.length, 0) > 12 && (
                          <div className="relative">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                            <input
                              value={filter}
                              onChange={(e) => setFilter(e.target.value)}
                              placeholder="Filter collections"
                              className="w-full bg-[var(--bg-highlight)] border border-[var(--border)] rounded-lg py-2 pl-8 pr-3 text-[12px] outline-none text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                            />
                          </div>
                        )}
                        <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden">
                          {test.databases.map((db) => {
                            const chosen = selection[db.name] ?? new Set<string>();
                            const state = chosen.size === 0 ? "none" : chosen.size === db.collections.length ? "all" : "some";
                            const open = expandedDbs.has(db.name) || !!filter;
                            const colls = db.collections.filter((c) => !filter || c.name.toLowerCase().includes(filter.toLowerCase()));
                            if (filter && colls.length === 0) return null;
                            return (
                              <div key={db.name}>
                                <div className="flex items-center gap-2.5 px-3 py-2.5 bg-[var(--bg-highlight)]/40">
                                  <Checkbox state={state} onClick={() => toggleDb(db)} />
                                  <button
                                    onClick={() => setExpandedDbs((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(db.name)) next.delete(db.name); else next.add(db.name);
                                      return next;
                                    })}
                                    className="flex-1 flex items-center gap-2 text-left cursor-pointer"
                                  >
                                    <Database size={13} className="text-[var(--text-muted)]" />
                                    <span className="text-[13px] font-medium text-[var(--text-primary)]">{db.name}</span>
                                    <span className="text-[11px] text-[var(--text-muted)]">{chosen.size}/{db.collections.length}</span>
                                    <ChevronDown size={13} className={`ml-auto text-[var(--text-muted)] transition-transform ${open ? "rotate-180" : ""}`} />
                                  </button>
                                </div>
                                {open && (
                                  <div className="py-1">
                                    {colls.map((c) => (
                                      <label
                                        key={c.name}
                                        className="flex items-center gap-2.5 pl-9 pr-3 py-1.5 hover:bg-[var(--bg-highlight)]/50 cursor-pointer"
                                      >
                                        <Checkbox state={chosen.has(c.name) ? "all" : "none"} onClick={() => toggleCollection(db.name, c.name)} />
                                        <span className="flex-1 text-[12.5px] text-[var(--text-secondary)] font-mono truncate">{c.name}</span>
                                        <span className="text-[11px] tabular-nums text-[var(--text-muted)]">{formatCount(c.count)}</span>
                                      </label>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => setStep("m-url")}
                        className="px-4 py-2 border border-[var(--border)] rounded-xl text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-all cursor-pointer"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => setStep(privacyRows.length > 0 ? "m-privacy" : "m-name")}
                        disabled={selectedCount === 0}
                        className="flex-1 py-2 bg-[var(--orange)] text-white rounded-xl font-semibold text-[12px] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                      >
                        Continue with {selectedCount} collection{selectedCount === 1 ? "" : "s"}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── MONGO 3: privacy review ─────────────────────────────────────── */}
                {step === "m-privacy" && (
                  <div className="space-y-3">
                    <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]">
                      These fields look sensitive. Hidden fields are removed from every result and the AI can&apos;t filter or group by them. Click a field to change it.
                    </p>
                    <div className="space-y-2.5">
                      {privacyRows.map(({ key, fields }) => (
                        <div key={key} className="p-3 rounded-xl border border-[var(--border)]">
                          <p className="text-[12px] font-mono text-[var(--text-primary)] mb-2">{key}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {fields.map((f) => {
                              const isHidden = (hidden[key] ?? []).includes(f);
                              return (
                                <button
                                  key={f}
                                  onClick={() => toggleHidden(key, f)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11.5px] font-mono border transition-all cursor-pointer"
                                  style={{
                                    borderColor: isHidden ? "rgba(248,113,113,0.3)" : "var(--border)",
                                    background: isHidden ? "rgba(248,113,113,0.08)" : "transparent",
                                    color: isHidden ? "var(--red)" : "var(--text-secondary)",
                                  }}
                                >
                                  {isHidden ? <EyeOff size={11} /> : <Eye size={11} />}
                                  {f}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)]">You can hide more fields later from the bridge details panel.</p>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => setStep("m-pick")}
                        className="px-4 py-2 border border-[var(--border)] rounded-xl text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-all cursor-pointer"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => setStep("m-name")}
                        className="flex-1 py-2 bg-[var(--orange)] text-white rounded-xl font-semibold text-[12px] hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
                      >
                        Continue
                      </button>
                    </div>
                  </div>
                )}

                {/* ── MONGO 4: name + save ─────────────────────────────────────────── */}
                {step === "m-name" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-medium text-[var(--text-secondary)] px-1">Bridge name</label>
                      <input
                        autoFocus
                        value={bridgeName}
                        onChange={(e) => setBridgeName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && bridgeName.trim()) save(); }}
                        maxLength={80}
                        className="w-full bg-[var(--bg-highlight)] border border-[var(--border)] rounded-xl py-3 px-4 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--orange)]/40"
                      />
                    </div>
                    <div className="p-3 rounded-xl bg-[var(--bg-highlight)]/60 border border-[var(--border)] space-y-1 text-[12px] text-[var(--text-secondary)]">
                      {scope.map((s) => (
                        <p key={s.db}>
                          <span className="font-mono text-[var(--text-primary)]">{s.db}</span>
                          {": "}
                          {s.collections[0] === "*" ? "all collections, including new ones" : s.collections.join(", ")}
                        </p>
                      ))}
                    </div>
                    {error && <ErrorBox message={error} />}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setStep(privacyRows.length > 0 ? "m-privacy" : "m-pick")}
                        className="px-4 py-2 border border-[var(--border)] rounded-xl text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-all cursor-pointer"
                      >
                        Back
                      </button>
                      <button
                        onClick={save}
                        disabled={!bridgeName.trim()}
                        className="flex-1 py-2 bg-[var(--orange)] text-white rounded-xl font-semibold text-[12px] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                      >
                        Create bridge
                      </button>
                    </div>
                  </div>
                )}

                {/* ── MONGO: scanning ──────────────────────────────────────────────── */}
                {step === "m-saving" && (
                  <div className="py-10 flex flex-col items-center justify-center gap-4 text-center">
                    <Loader2 size={24} className="text-[var(--orange)] animate-spin" />
                    <div>
                      <p className="text-[13px] font-medium text-[var(--text-primary)]">Sampling your collections</p>
                      <p className="text-[11px] text-[var(--text-muted)] mt-1 max-w-[280px]">
                        WUUP reads a small sample of each collection to learn field names and types, so answers use your real schema.
                      </p>
                    </div>
                  </div>
                )}

                {/* ── MONGO: ready ─────────────────────────────────────────────────── */}
                {step === "m-ready" && created && (
                  <div className="space-y-4">
                    {created.status === "error" ? (
                      <ErrorBox message={created.lastError ?? "Schema scan failed. You can retry from the bridge panel."} />
                    ) : (
                      <div className="flex items-center gap-3 p-3 rounded-xl border border-green-500/20 bg-green-500/5">
                        <CheckCircle2 size={18} className="text-[var(--green)] shrink-0" />
                        <div>
                          <p className="text-[13px] font-medium text-[var(--text-primary)]">{created.name} is live</p>
                          <p className="text-[11px] text-[var(--text-muted)]">
                            {created.stats.collections} collection{created.stats.collections === 1 ? "" : "s"} across {created.stats.databases} database{created.stats.databases === 1 ? "" : "s"}
                            {created.status === "scanning" ? " · still scanning" : ""}
                          </p>
                        </div>
                      </div>
                    )}

                    {created.suggestions.length > 0 && (
                      <div className="space-y-2">
                        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]">
                          <Sparkles size={11} /> Try asking
                        </p>
                        <div className="space-y-1.5">
                          {created.suggestions.map((q) => (
                            <button
                              key={q}
                              onClick={() => { onAsk?.(q); onClose(); }}
                              className="w-full text-left px-3.5 py-2.5 rounded-xl border border-[var(--border)] text-[12.5px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--orange)]/30 hover:bg-[var(--orange)]/5 transition-all cursor-pointer"
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={onClose}
                      className="w-full py-2 border border-[var(--border)] rounded-xl text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                )}

                {/* STEP: SUCCESS */}
                {step === "success" && (
                  <div className="py-8 flex flex-col items-center justify-center gap-4">
                    <div className="w-14 h-14 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center text-green-500/80">
                      <CheckCircle2 size={28} />
                    </div>
                    <div className="text-center">
                      <p className="text-[13px] font-semibold text-[var(--text-primary)]">Bridge Active</p>
                      <p className="text-[11px] text-[var(--text-muted)]">Syncing context with Brain...</p>
                    </div>
                  </div>
                )}

                {/* STEP: LOADING */}
                {step === "loading" && (
                  <div className="py-12 flex flex-col items-center justify-center gap-4">
                    <Loader2 size={24} className="text-[var(--text-muted)] animate-spin" />
                    <p className="text-[11px] text-[var(--text-muted)] tracking-widest uppercase">Connecting...</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 p-3 rounded-xl border border-red-500/20 bg-red-500/5">
      <AlertCircle size={14} className="shrink-0 mt-0.5 text-[var(--red)]" />
      <p className="text-[12px] leading-relaxed text-[var(--red)]">{message}</p>
    </div>
  );
}

export function Checkbox({ state, onClick }: { state: "all" | "some" | "none"; onClick: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={state === "all" ? true : state === "some" ? "mixed" : false}
      onClick={(e) => { e.preventDefault(); onClick(); }}
      className="w-4 h-4 rounded-[5px] border flex items-center justify-center shrink-0 transition-colors cursor-pointer"
      style={{
        borderColor: state === "none" ? "var(--border-hover)" : "var(--orange)",
        background: state === "none" ? "transparent" : "var(--orange)",
      }}
    >
      {state === "all" && (
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.2l2.3 2.3 4.7-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      )}
      {state === "some" && <div className="w-2 h-[2px] rounded bg-white" />}
    </button>
  );
}
