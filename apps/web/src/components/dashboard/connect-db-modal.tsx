"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, Database, Table2, Zap, 
  ChevronRight, Globe, Lock, 
  ShieldCheck, Copy, Check,
  CheckCircle2, Loader2, ExternalLink
} from "lucide-react";

interface ConnectDbModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = "choice" | "method" | "automated" | "manual" | "assistant" | "loading" | "success";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const WUP_ASSISTANT_EMAIL = "bridge@wup-ai.iam.gserviceaccount.com";

export function ConnectDbModal({ isOpen, onClose }: ConnectDbModalProps) {
  const [step, setStep] = useState<Step>("choice");
  const [selectedSource, setSelectedSource] = useState<{ name: string, icon: any, type: string } | null>(null);
  const [manualUrl, setManualUrl] = useState("");
  const [copied, setCopied] = useState(false);

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

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(WUP_ASSISTANT_EMAIL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleManualConnect = async () => {
    setStep("loading");
    const token = localStorage.getItem("wup_token");
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
            style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed z-[101] inset-0 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="w-full max-w-sm pointer-events-auto rounded-2xl overflow-hidden"
              style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
                <div>
                  <p className="text-sm font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
                    {step === "choice" && "Data Source"}
                    {step === "method" && "Select Method"}
                    {step === "manual" && "Manual Connect"}
                    {step === "assistant" && "Access Assistant"}
                    {step === "automated" && "Discovery"}
                    {step === "loading" && "Connecting"}
                    {step === "success" && "Success"}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {selectedSource ? selectedSource.name : "Select a bridge to start"}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"}
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
                        className="w-full flex items-center gap-3.5 p-3 rounded-xl hover:bg-white/[0.04] transition-all group text-left"
                      >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-muted)" }}>
                          {source.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-[13px] font-medium text-white/80 group-hover:text-white transition-colors">{source.name}</h3>
                          <p className="text-[11px] text-white/20 font-light truncate">{source.description}</p>
                        </div>
                        <ChevronRight size={14} className="text-white/5 group-hover:text-white/20 transition-all" />
                      </button>
                    ))}
                  </div>
                )}

                {/* STEP: METHOD CHOICE */}
                {step === "method" && (
                  <div className="space-y-3">
                    <button 
                      onClick={() => setStep("automated")}
                      className="w-full flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.05] transition-all group text-left"
                    >
                      <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400/60">
                        <Globe size={18} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-[13px] font-medium text-white/90">Seamless Discovery</h3>
                        <p className="text-[11px] text-white/30">Connect and pick visually.</p>
                      </div>
                    </button>

                    <div className="flex items-center gap-3 py-1">
                      <div className="h-[1px] flex-1 bg-white/[0.05]" />
                      <span className="text-[9px] text-white/10 uppercase tracking-widest font-bold">or</span>
                      <div className="h-[1px] flex-1 bg-white/[0.05]" />
                    </div>

                    <button 
                      onClick={() => setStep("manual")}
                      className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/[0.05] hover:bg-white/[0.02] transition-all group text-left"
                    >
                      <div className="w-9 h-9 rounded-full bg-white/[0.05] flex items-center justify-center text-white/30">
                        <Lock size={18} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-[13px] font-medium text-white/70">Manual Link</h3>
                        <p className="text-[11px] text-white/20">Paste a direct connection URI.</p>
                      </div>
                    </button>

                    <button onClick={() => setStep("choice")} className="w-full text-center text-[11px] text-white/25 hover:text-white/50 transition-all py-2 mt-2">
                      Back to sources
                    </button>
                  </div>
                )}

                {/* STEP: MANUAL INPUT */}
                {step === "manual" && (
                  <div className="space-y-5">
                    <div className="space-y-2.5">
                      <p className="text-[11px] text-white/40 px-1 leading-relaxed">
                        Enter the connection URL for your {selectedSource?.name}.
                      </p>
                      <input 
                        autoFocus
                        type="text"
                        value={manualUrl}
                        onChange={(e) => setManualUrl(e.target.value)}
                        placeholder="Paste connection link here..."
                        className="w-full bg-white/[0.02] border border-white/[0.08] rounded-xl py-3 px-4 text-[13px] text-white placeholder:text-white/10 focus:border-white/20 transition-all outline-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setStep("method")}
                        className="px-4 py-2 border border-white/[0.05] rounded-xl text-[12px] font-medium text-white/30 hover:text-white/60 transition-all"
                      >
                        Back
                      </button>
                      <button 
                        onClick={handleManualConnect}
                        disabled={!manualUrl}
                        className="flex-1 py-2 bg-white text-black rounded-xl font-semibold text-[12px] hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-50"
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
                      <p className="text-[13px] font-semibold text-white/90">Bridge Active</p>
                      <p className="text-[11px] text-white/25">Syncing context with Brain...</p>
                    </div>
                  </div>
                )}

                {/* STEP: LOADING */}
                {step === "loading" && (
                  <div className="py-12 flex flex-col items-center justify-center gap-4">
                    <Loader2 size={24} className="text-white/20 animate-spin" />
                    <p className="text-[11px] text-white/20 tracking-widest uppercase">Connecting...</p>
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
