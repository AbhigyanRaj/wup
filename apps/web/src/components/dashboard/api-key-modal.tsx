"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Key, CheckCircle2, Loader2, Trash2, ShieldAlert, Sparkles } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

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
  openrouter: "OpenRouter (All Models)",
};

const PROVIDER_LINKS: Record<string, { label: string, url: string }> = {
  gemini: { label: "Google AI Studio", url: "https://aistudio.google.com/" },
  openai: { label: "OpenAI Platform", url: "https://platform.openai.com/api-keys" },
  anthropic: { label: "Anthropic Console", url: "https://console.anthropic.com/" },
  openrouter: { label: "OpenRouter Console", url: "https://openrouter.ai/keys" },
};

export function ApiKeyModal({ isOpen, onClose, onSaved, usage }: ApiKeyModalProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";

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
                    {usage?.hasCustomKey && !showUpdateForm ? "Active API Key" : "Add AI API Key"}
                  </p>
                  <p className="text-[11px] mt-0.5 text-[var(--text-muted)]">
                    {usage?.hasCustomKey && !showUpdateForm ? "Manage your AI integration" : "Unlock unlimited queries"}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
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
                      <p className="text-[13.5px] font-semibold text-[var(--text-primary)]">
                        {lastAction === "delete" ? "API Key Removed" : "API Key Saved"}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        {lastAction === "delete" ? "Switched back to Free Tier limits." : "You can now chat without limits!"}
                      </p>
                    </div>
                  </div>
                ) : usage?.hasCustomKey && !showUpdateForm ? (
                  // Active key status card
                  <div className="space-y-5">
                    <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-highlight)] space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--orange)]"
                          style={{ background: "var(--orange-dim)", border: "1px solid var(--border)" }}>
                          <Key size={16} />
                        </div>
                        <div>
                          <p className="text-[12px] font-semibold text-[var(--text-primary)]">
                            {PROVIDER_NAMES[usage.provider || "gemini"] || "Gemini (Google)"}
                          </p>
                          <p className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5 tracking-wider">
                            {usage.maskedKey || "••••••••"}
                          </p>
                        </div>
                      </div>

                      <div className="h-px bg-[var(--border)]" />

                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[var(--text-muted)] font-medium">Status</span>
                        <span className="flex items-center gap-1.5 font-semibold text-[var(--orange)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--orange)] shadow-[0_0_6px_rgba(37,99,235,0.45)]" />
                          Active & Unlimited
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleDelete}
                        disabled={status === "deleting"}
                        className="flex-1 py-2.5 rounded-xl font-semibold text-[12px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] border border-red-500/20 hover:bg-red-500/10 text-red-500 bg-red-500/5 cursor-pointer"
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
                        className="flex-1 py-2.5 rounded-xl font-semibold text-[12px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] border border-[var(--border)] hover:bg-[var(--bg-highlight)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
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
                        <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest px-1">
                          Provider
                        </p>
                        <select
                          value={provider}
                          onChange={(e) => setProvider(e.target.value)}
                          className="w-full bg-[var(--bg-highlight)] border border-[var(--border)] rounded-xl py-2.5 px-4 text-[13px] text-[var(--text-primary)] transition-all outline-none"
                        >
                          <option value="gemini">Gemini (Google)</option>
                          <option value="openrouter">OpenRouter (All Models)</option>
                          <option value="openai">OpenAI (ChatGPT)</option>
                          <option value="anthropic">Anthropic (Claude)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest px-1">
                          API Key
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)] px-1 leading-relaxed">
                          Enter your key. It will be stored securely.
                        </p>
                        <input 
                          type="password"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder="AIzaSy... or sk-..."
                          className="w-full bg-[var(--bg-highlight)] border border-[var(--border)] rounded-xl py-2.5 px-4 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-all outline-none"
                        />
                      </div>
                      {error && (
                        <div className="flex items-center gap-1.5 text-red-500 px-1 pt-0.5">
                          <ShieldAlert size={12} className="shrink-0" />
                          <p className="text-[11px] font-medium">{error}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={handleSave}
                        disabled={!apiKey.trim() || status === "loading"}
                        className="w-full py-2.5 rounded-xl font-semibold text-[12px] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-white cursor-pointer"
                        style={{ background: "var(--orange)", boxShadow: "0 0 16px rgba(37,99,235,0.2)" }}
                      >
                        {status === "loading" && <Loader2 size={13} className="animate-spin" />}
                        Save Key
                      </button>

                      {usage?.hasCustomKey && (
                        <button
                          onClick={() => { setShowUpdateForm(false); setError(""); }}
                          className="w-full text-center text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all py-1.5 cursor-pointer"
                        >
                          Cancel Update
                        </button>
                      )}
                      
                      {!usage?.hasCustomKey && (
                        <a 
                          href={PROVIDER_LINKS[provider]?.url || "#"} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="w-full text-center text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all py-2 flex items-center justify-center gap-1 cursor-pointer"
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
