"use client";

import React, { useState, useRef } from "react";
import { ArrowUp, ChevronDown, Paperclip, Globe } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "@/components/theme-provider";

const MODELS = [
  { id: "Auto-Rotate",              name: "Auto",        desc: "Best available" },
  { id: "gemini-2.5-flash",         name: "Gemini 2.5",  desc: "Premium"        },
  { id: "gemini-2.0-flash",         name: "Gemini 2.0",  desc: "Balanced"       },
  { id: "gemini-flash-lite-latest", name: "Flash Lite",  desc: "Fastest"        },
];

interface AskBarProps {
  onSubmit: (message: string, model: string, searchWeb: boolean) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  exhaustedModels?: string[];
  usage?: { freeTierUsage: number; freeTierLimit: number; hasCustomKey: boolean; availableModels?: string[] } | null;
}

export function AskBar({ onSubmit, selectedModel, onModelChange, exhaustedModels = [], usage }: AskBarProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  
  const [input, setInput]         = useState("");
  const [focused, setFocused]     = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [searchWeb, setSearchWeb] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  const isLimitReached = !!(usage && !usage.hasCustomKey && usage.freeTierUsage >= usage.freeTierLimit);
  const canSend     = input.trim().length > 0 && !isLimitReached;

  // Dynamic models
  const dynamicModels = usage?.hasCustomKey && usage.availableModels && usage.availableModels.length > 0
    ? [
        { id: "Auto-Rotate", name: "Auto", desc: "Best available" },
        ...usage.availableModels.slice(0, 30).map((m) => {
          let displayName = m;
          if (m.includes("/")) {
            displayName = m.split("/")[1];
          }
          displayName = displayName
            .replace("gemini-", "Gemini ")
            .replace("claude-", "Claude ")
            .replace("gpt-", "GPT-")
            .replace("llama-", "Llama ")
            .replace("-latest", " L")
            .replace("-preview", " P")
            .replace("-flash", " Flash")
            .replace("-pro", " Pro");
          let providerLabel = "API KEY";
          if (m.startsWith("google/") || m.includes("gemini")) providerLabel = "Google";
          else if (m.startsWith("anthropic/") || m.includes("claude")) providerLabel = "Anthropic";
          else if (m.startsWith("openai/") || m.includes("gpt")) providerLabel = "OpenAI";
          else if (m.startsWith("meta-llama/") || m.includes("llama")) providerLabel = "Meta";
          else if (m.includes("/")) providerLabel = m.split("/")[0].toUpperCase();

          return {
            id: m,
            name: displayName,
            desc: providerLabel
          };
        })
      ]
    : MODELS;

  const activeModel = dynamicModels.find(m => m.id === selectedModel) ?? dynamicModels[0];

  const submit = () => {
    if (!canSend) return;
    onSubmit(input.trim(), selectedModel, searchWeb);
    setInput("");
    setModelOpen(false);
    if (ref.current) ref.current.style.height = "auto";
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  const resize = () => {
    if (!ref.current) return;
    ref.current.style.height = "auto";
    ref.current.style.height = Math.min(ref.current.scrollHeight, 160) + "px";
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto">

      {/* ── Model dropdown ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modelOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            className="absolute bottom-full mb-2 left-0 z-50 w-48 rounded-xl overflow-hidden border"
            style={{
              background: "var(--bg-overlay)",
              borderColor: "var(--border)",
              boxShadow: isLight ? "0 8px 30px rgba(0,0,0,0.06)" : "0 8px 40px rgba(0,0,0,0.6)",
            }}
          >
            <p className="px-3.5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest"
               style={{ color: "var(--text-muted)" }}>
              Model
            </p>
            <div className="max-h-[300px] overflow-y-auto">
              {dynamicModels.map(m => {
                const exhausted = exhaustedModels.includes(m.id);
                const isActive  = m.id === selectedModel;
                return (
                  <button
                    key={m.id}
                    disabled={exhausted}
                    onClick={() => { onModelChange(m.id); setModelOpen(false); }}
                    className="w-full flex items-center justify-between px-4 py-2 text-left transition-colors"
                    style={{
                      background: isActive ? "var(--bg-highlight)" : "transparent",
                      opacity: exhausted ? 0.4 : 1,
                      cursor: exhausted ? "not-allowed" : "pointer",
                    }}
                    onMouseEnter={e => { if (!exhausted) (e.currentTarget as HTMLElement).style.background = "var(--bg-highlight)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isActive ? "var(--bg-highlight)" : "transparent"; }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-medium leading-tight truncate"
                         style={{ color: isActive ? "var(--orange)" : "var(--text-secondary)" }}>
                        {m.name}
                      </p>
                      {m.desc && (
                        <p className="text-[9.5px] mt-0.5 tracking-wider uppercase opacity-45 font-bold" style={{ color: "var(--text-muted)" }}>
                          {m.desc}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {exhausted && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                              style={{ background: "rgba(248,113,113,0.15)", color: "var(--red)" }}>
                          MAX
                        </span>
                      )}
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--orange)] shadow-[0_0_8px_rgba(37,99,235,0.6)]" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="h-1.5" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main input card ────────────────────────────────────────────────── */}
      <div
        className="relative transition-all duration-300 ease-out group border"
        style={{
          background: focused ? "var(--bg-highlight)" : "var(--bg-raised)",
          borderRadius: "20px",
          borderColor: focused 
            ? (isLight ? "rgba(37, 99, 235, 0.3)" : "rgba(37, 99, 235, 0.2)") 
            : "var(--border)",
          boxShadow: focused
            ? (isLight 
                ? "0 0 0 1px rgba(37, 99, 235, 0.08), 0 12px 30px -8px rgba(0,0,0,0.05)" 
                : "0 0 0 1px rgba(37, 99, 235, 0.1), 0 20px 50px -12px rgba(0,0,0,0.5)")
            : (isLight 
                ? "0 4px 15px -5px rgba(0,0,0,0.02)" 
                : "0 10px 30px -15px rgba(0,0,0,0.3)"),
        }}
      >
        {/* Textarea */}
        <textarea
          ref={ref}
          rows={1}
          value={input}
          onChange={e => { setInput(e.target.value); resize(); }}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={isLimitReached ? "Free tier limit reached. Add your API key to continue." : "Message WUUP..."}
          disabled={isLimitReached}
          className={`w-full bg-transparent resize-none text-[15px] leading-relaxed placeholder:text-[var(--text-muted)] ${isLimitReached ? "cursor-not-allowed opacity-50" : ""}`}
          style={{
            padding: "18px 20px 56px",
            color: "var(--text-primary)",
            caretColor: "var(--orange)",
            fontFamily: "inherit",
            maxHeight: "200px",
            border: "none",
            outline: "none",
          }}
        />

        {/* ── Bottom toolbar ──────────────────────────────────────────────── */}
        <div
          className="absolute bottom-0 left-0 right-0 flex items-center justify-between"
          style={{ padding: "0 12px 12px" }}
        >
          {/* Left — attach + model */}
          <div className="flex items-center gap-1">
            <button
              className="p-2.5 rounded-xl transition-all hover:bg-white/[0.05] hover:text-white/60 active:scale-95 cursor-pointer"
              style={{ color: "var(--text-muted)" }}
              title="Attach context"
            >
              <Paperclip size={16} />
            </button>

            <div className="w-[1px] h-4 bg-white/[0.06] mx-1" />

            {/* Search Web Toggle */}
            <button
              onClick={() => setSearchWeb(s => !s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wide uppercase transition-all cursor-pointer ${searchWeb ? "bg-[var(--orange)]/10 text-[var(--orange)]" : "hover:bg-white/[0.05] text-[var(--text-secondary)]"}`}
              title="Search Web Grounding"
            >
              <Globe size={13} />
              <span className="opacity-90">Web</span>
            </button>

            <div className="w-[1px] h-4 bg-white/[0.06] mx-1" />

            {/* Model picker trigger */}
            <button
              onClick={() => setModelOpen(o => !o)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-bold tracking-wide uppercase transition-all hover:bg-white/[0.05] cursor-pointer"
              style={{
                color: modelOpen ? "var(--text-primary)" : "var(--text-secondary)",
              }}
            >
              <span className="opacity-80">{activeModel.name}</span>
              <ChevronDown
                size={12}
                className={`transition-transform duration-300 ${modelOpen ? "rotate-180" : ""}`}
              />
            </button>

            {usage && !usage.hasCustomKey && (
              <div className="flex items-center gap-2 ml-3">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest select-none">
                  Usage
                </span>
                <div className="w-12 h-1 bg-[var(--border)] rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-300" 
                    style={{ 
                      width: `${Math.min((usage.freeTierUsage / usage.freeTierLimit) * 100, 100)}%`,
                      background: usage.freeTierUsage >= usage.freeTierLimit ? "var(--red)" : "var(--orange)",
                      boxShadow: usage.freeTierUsage >= usage.freeTierLimit ? "none" : "0 0 5px rgba(37,99,235,0.4)"
                    }}
                  />
                </div>
                <span className="text-[10px] font-bold text-[var(--text-muted)] select-none">
                  {usage.freeTierUsage}/{usage.freeTierLimit}
                </span>
              </div>
            )}
          </div>

          {/* Right — send */}
          <motion.button
            onClick={submit}
            disabled={!canSend}
            whileHover={canSend ? { scale: 1.05 } : {}}
            whileTap={canSend ? { scale: 0.95 } : {}}
            className="w-10 h-10 flex items-center justify-center rounded-2xl transition-all shadow-lg"
            style={{
              background: canSend ? "var(--orange)" : "var(--bg-highlight)",
              color: canSend ? "#ffffff" : "var(--text-muted)",
              cursor: canSend ? "pointer" : "not-allowed",
              boxShadow: canSend ? "0 0 15px rgba(37, 99, 235, 0.4)" : "none"
            }}
          >
            <ArrowUp size={18} strokeWidth={3} />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
