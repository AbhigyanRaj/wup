"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Key, CheckCircle2, Loader2, ExternalLink } from "lucide-react";

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const PROVIDER_LINKS: Record<string, { label: string, url: string }> = {
  gemini: { label: "Google AI Studio", url: "https://aistudio.google.com/" },
  openai: { label: "OpenAI Platform", url: "https://platform.openai.com/api-keys" },
  anthropic: { label: "Anthropic Console", url: "https://console.anthropic.com/" },
};

export function ApiKeyModal({ isOpen, onClose, onSaved }: ApiKeyModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState("gemini");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setApiKey("");
        setStatus("idle");
        setError("");
      }, 400);
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    
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
                    Add AI API Key
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Unlock unlimited queries
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

              <div className="p-4">
                {status === "success" ? (
                  <div className="py-6 flex flex-col items-center justify-center gap-4">
                    <div className="w-14 h-14 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center text-green-500/80">
                      <CheckCircle2 size={28} />
                    </div>
                    <div className="text-center">
                      <p className="text-[13px] font-semibold text-white/90">API Key Saved</p>
                      <p className="text-[11px] text-white/25">You can now chat without limits!</p>
                    </div>
                  </div>
                ) : (
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
                          style={{ color: "var(--text-primary)", background: "var(--bg-overlay)" }}
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
                      {error && <p className="text-[11px] text-red-400 px-1">{error}</p>}
                    </div>

                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={handleSave}
                        disabled={!apiKey.trim() || status === "loading"}
                        className="w-full py-2.5 bg-white text-black rounded-xl font-semibold text-[12px] hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {status === "loading" && <Loader2 size={14} className="animate-spin" />}
                        Save Key
                      </button>
                      
                      <a 
                        href={PROVIDER_LINKS[provider]?.url || "#"} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="w-full text-center text-[11px] text-white/25 hover:text-white/50 transition-all py-2 flex items-center justify-center gap-1"
                      >
                        Get a key from {PROVIDER_LINKS[provider]?.label || "Provider"} <ExternalLink size={10} />
                      </a>
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
