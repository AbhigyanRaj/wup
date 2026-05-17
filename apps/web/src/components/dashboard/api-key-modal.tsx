"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Key, CheckCircle2, Loader2, Trash2, ShieldAlert, Sparkles } from "lucide-react";

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  usage?: { freeTierUsage: number; freeTierLimit: number; hasCustomKey: boolean; maskedKey?: string; provider?: string } | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const PROVIDER_NAMES: Record<string, string> = {
  gemini: "Gemini (Google)",
  openai: "OpenAI (ChatGPT)",
  anthropic: "Anthropic (Claude)",
};

const PROVIDER_LINKS: Record<string, { label: string, url: string }> = {
  gemini: { label: "Google AI Studio", url: "https://aistudio.google.com/" },
  openai: { label: "OpenAI Platform", url: "https://platform.openai.com/api-keys" },
  anthropic: { label: "Anthropic Console", url: "https://console.anthropic.com/" },
};

export function ApiKeyModal({ isOpen, onClose, onSaved, usage }: ApiKeyModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState("gemini");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error" | "deleting">("idle");
  const [error, setError] = useState("");
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [lastAction, setLastAction] = useState<"save" | "delete">("save");

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setApiKey("");
        setStatus("idle");
        setError("");
        setShowUpdateForm(false);
        setLastAction("save");
      }, 400);
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    
    setLastAction("save");
    setStatus("loading");
    setError("");
    const token = localStorage.getItem("wuup_token");
    
    try {
      const res = await fetch(`${API_URL}/user/api-key`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ apiKey: apiKey.trim(), provider })
      });
      
      if (res.ok) {
        setStatus("success");
        if (onSaved) onSaved();
        setTimeout(() => onClose(), 1500);
      } else {
        const data = await res.json().catch(() => ({}));
        setStatus("error");
        setError(data.error || "Failed to save API key");
      }
    } catch (err) {
      setStatus("error");
      setError("Network error. Failed to save API key.");
    }
  };

  const handleDelete = async () => {
    setLastAction("delete");
    setStatus("deleting");
    setError("");
    const token = localStorage.getItem("wuup_token");
    
    try {
      const res = await fetch(`${API_URL}/user/api-key`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        setStatus("success");
        if (onSaved) onSaved();
        setTimeout(() => onClose(), 1500);
      } else {
        const data = await res.json().catch(() => ({}));
        setStatus("error");
        setError(data.error || "Failed to delete API key");
      }
    } catch (err) {
      setStatus("error");
      setError("Network error. Failed to delete API key.");
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
              className="w-full max-w-sm pointer-events-auto rounded-3xl overflow-hidden"
              style={{ background: "rgba(13,13,13,0.95)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 24px 50px -12px rgba(0,0,0,0.9)" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                <div>
                  <p className="text-sm font-semibold tracking-tight text-white/90">
                    {usage?.hasCustomKey && !showUpdateForm ? "Active API Key" : "Add AI API Key"}
                  </p>
                  <p className="text-[11px] mt-0.5 text-white/40">
                    {usage?.hasCustomKey && !showUpdateForm ? "Manage your AI integration" : "Unlock unlimited queries"}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg transition-colors text-white/30 hover:text-white/70"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="p-5">
                {status === "success" ? (
                  <div className="py-6 flex flex-col items-center justify-center gap-4">
                    <div className="w-14 h-14 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center text-green-500/80">
                      <CheckCircle2 size={28} />
                    </div>
                    <div className="text-center">
                      <p className="text-[13.5px] font-semibold text-white/90">
                        {lastAction === "delete" ? "API Key Removed" : "API Key Saved"}
                      </p>
                      <p className="text-[11px] text-white/30">
                        {lastAction === "delete" ? "Switched back to Free Tier limits." : "You can now chat without limits!"}
                      </p>
                    </div>
                  </div>
                ) : usage?.hasCustomKey && !showUpdateForm ? (
                  // Active key status card
                  <div className="space-y-5">
                    <div className="p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--orange)]"
                          style={{ background: "rgba(255,95,31,0.08)", border: "1px solid rgba(255,95,31,0.18)" }}>
                          <Key size={16} />
                        </div>
                        <div>
                          <p className="text-[12px] font-semibold text-white/80">
                            {PROVIDER_NAMES[usage.provider || "gemini"] || "Gemini (Google)"}
                          </p>
                          <p className="text-[10px] font-mono text-white/30 mt-0.5 tracking-wider">
                            {usage.maskedKey || "••••••••"}
                          </p>
                        </div>
                      </div>

                      <div className="h-px bg-white/[0.06]" />

                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-white/30 font-medium">Status</span>
                        <span className="flex items-center gap-1.5 font-semibold text-[var(--orange)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--orange)] shadow-[0_0_6px_rgba(255,95,31,0.5)]" />
                          Active & Unlimited
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleDelete}
                        disabled={status === "deleting"}
                        className="flex-1 py-2.5 rounded-xl font-semibold text-[12px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] border border-red-500/20 hover:bg-red-500/10 text-red-400"
                        style={{ background: "rgba(239,68,68,0.03)" }}
                      >
                        {status === "deleting" ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Trash2 size={13} />
                        )}
                        Remove Key
                      </button>

                      <button
                        onClick={() => setShowUpdateForm(true)}
                        className="flex-1 py-2.5 rounded-xl font-semibold text-[12px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] border border-white/[0.08] hover:bg-white/[0.04] text-white/80"
                      >
                        <Sparkles size={13} style={{ color: "var(--orange)" }} />
                        Rotate Key
                      </button>
                    </div>
                  </div>
                ) : (
                  // Entry/update form
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">
                          Provider
                        </p>
                        <select
                          value={provider}
                          onChange={(e) => setProvider(e.target.value)}
                          className="w-full bg-white/[0.02] border border-white/[0.08] rounded-xl py-2.5 px-4 text-[13px] text-white focus:border-white/20 transition-all outline-none"
                          style={{ color: "var(--text-primary)", background: "#111" }}
                        >
                          <option value="gemini">Gemini (Google)</option>
                          <option value="openai">OpenAI (ChatGPT)</option>
                          <option value="anthropic">Anthropic (Claude)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">
                          API Key
                        </p>
                        <p className="text-[11px] text-white/25 px-1 leading-relaxed">
                          Enter your key. It will be stored securely.
                        </p>
                        <input 
                          type="password"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder="AIzaSy... or sk-..."
                          className="w-full bg-white/[0.02] border border-white/[0.08] rounded-xl py-2.5 px-4 text-[13px] text-white placeholder:text-white/10 focus:border-white/20 transition-all outline-none"
                        />
                      </div>
                      {error && (
                        <div className="flex items-center gap-1.5 text-red-400 px-1 pt-0.5">
                          <ShieldAlert size={12} className="shrink-0" />
                          <p className="text-[11px] font-medium">{error}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={handleSave}
                        disabled={!apiKey.trim() || status === "loading"}
                        className="w-full py-2.5 rounded-xl font-semibold text-[12px] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-black"
                        style={{ background: "var(--orange)", boxShadow: "0 0 16px rgba(255,95,31,0.2)" }}
                      >
                        {status === "loading" && <Loader2 size={13} className="animate-spin" />}
                        Save Key
                      </button>

                      {usage?.hasCustomKey && (
                        <button
                          onClick={() => { setShowUpdateForm(false); setError(""); }}
                          className="w-full text-center text-[11px] text-white/30 hover:text-white/60 transition-all py-1.5"
                        >
                          Cancel Update
                        </button>
                      )}
                      
                      {!usage?.hasCustomKey && (
                        <a 
                          href={PROVIDER_LINKS[provider]?.url || "#"} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="w-full text-center text-[11px] text-white/25 hover:text-white/50 transition-all py-2 flex items-center justify-center gap-1"
                        >
                          Get a key from {PROVIDER_LINKS[provider]?.label || "Provider"}
                        </a>
                      )}
                    </div>
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
