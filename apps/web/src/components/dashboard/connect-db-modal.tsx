"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, Database, Table2, Zap, 
  ChevronRight, Globe, Lock, 
  CheckCircle2, Loader2
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";

interface ConnectDbModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = "choice" | "method" | "automated" | "manual" | "assistant" | "loading" | "success";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function ConnectDbModal({ isOpen, onClose }: ConnectDbModalProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";

  const [step, setStep] = useState<Step>("choice");
  const [selectedSource, setSelectedSource] = useState<{ name: string, icon: any, type: string } | null>(null);
  const [manualUrl, setManualUrl] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setStep("choice");
        setSelectedSource(null);
        setManualUrl("");
      }, 400);
    }
  }, [isOpen]);

  const sources = [
    { name: "Google Sheets", type: "sheets", icon: <Table2 size={16} />, description: "Cloud Spreadsheet Picker" },
    { name: "MongoDB", type: "mongodb", icon: <Database size={16} />, description: "Live Atlas Discovery" },
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
              className="w-full max-w-sm pointer-events-auto rounded-3xl overflow-hidden border"
              style={{ 
                background: "var(--bg-overlay)", 
                borderColor: "var(--border)",
                boxShadow: isLight ? "0 12px 30px rgba(0,0,0,0.06)" : "0 24px 50px -12px rgba(0,0,0,0.8)"
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                <div>
                  <p className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">
                    {step === "choice" && "Data Source"}
                    {step === "method" && "Select Method"}
                    {step === "manual" && "Manual Connect"}
                    {step === "assistant" && "Access Assistant"}
                    {step === "automated" && "Discovery"}
                    {step === "loading" && "Connecting"}
                    {step === "success" && "Success"}
                  </p>
                  <p className="text-[11px] mt-0.5 text-[var(--text-muted)]">
                    {selectedSource ? selectedSource.name : "Select a bridge to start"}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="p-4 max-h-[400px] overflow-y-auto scrollbar-hide">
                {/* STEP: SOURCE CHOICE */}
                {step === "choice" && (
                  <div className="space-y-1">
                    {sources.map((source) => (
                      <button
                        key={source.name}
                        onClick={() => { setSelectedSource(source); setStep("method"); }}
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

                {/* STEP: METHOD CHOICE */}
                {step === "method" && (
                  <div className="space-y-3">
                    <button 
                      onClick={() => setStep("automated")}
                      className="w-full flex items-center gap-4 p-4 rounded-xl border transition-all group text-left cursor-pointer bg-[var(--bg-highlight)] border-[var(--border)]"
                    >
                      <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                        <Globe size={18} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-[13px] font-medium text-[var(--text-primary)]">Seamless Discovery</h3>
                        <p className="text-[11px] text-[var(--text-secondary)]">Connect and pick visually.</p>
                      </div>
                    </button>

                    <div className="flex items-center gap-3 py-1">
                      <div className="h-[1px] flex-1 bg-[var(--border)]" />
                      <span className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest font-bold">or</span>
                      <div className="h-[1px] flex-1 bg-[var(--border)]" />
                    </div>

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

                {/* STEP: MANUAL INPUT */}
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
