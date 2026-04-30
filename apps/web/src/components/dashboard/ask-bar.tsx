"use client";

import React, { useState, useRef } from "react";
import { ArrowUp, ChevronDown, Paperclip } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const MODELS = [
  { id: "Auto-Rotate",              name: "Auto",        desc: "Best available" },
  { id: "gemini-2.5-flash",         name: "Gemini 2.5",  desc: "Premium"        },
  { id: "gemini-2.0-flash",         name: "Gemini 2.0",  desc: "Balanced"       },
  { id: "gemini-flash-lite-latest", name: "Flash Lite",  desc: "Fastest"        },
];

interface AskBarProps {
  onSubmit: (message: string, model: string) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  exhaustedModels?: string[];
}

export function AskBar({ onSubmit, selectedModel, onModelChange, exhaustedModels = [] }: AskBarProps) {
  const [input, setInput]         = useState("");
  const [focused, setFocused]     = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  const activeModel = MODELS.find(m => m.id === selectedModel) ?? MODELS[0];
  const canSend     = input.trim().length > 0;

  const submit = () => {
    if (!canSend) return;
    onSubmit(input.trim(), selectedModel);
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
            className="absolute bottom-full mb-2 left-0 z-50 w-48 rounded-xl overflow-hidden"
            style={{
              background: "var(--bg-overlay)",
              border: "1px solid var(--border)",
              boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
            }}
          >
            <p className="px-3.5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest"
               style={{ color: "var(--text-muted)" }}>
              Model
            </p>
            {MODELS.map(m => {
              const exhausted = exhaustedModels.includes(m.id);
              const isActive  = m.id === selectedModel;
              return (
                <button
                  key={m.id}
                  disabled={exhausted}
                  onClick={() => { onModelChange(m.id); setModelOpen(false); }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors"
                  style={{
                    background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                    opacity: exhausted ? 0.4 : 1,
                    cursor: exhausted ? "not-allowed" : "pointer",
                  }}
                  onMouseEnter={e => { if (!exhausted) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isActive ? "rgba(255,255,255,0.08)" : "transparent"; }}
                >
                  {/* Active indicator */}
                  <div
                    className="w-1 h-4 rounded-full shrink-0 shadow-[0_0_8px_rgba(255,95,31,0.4)]"
                    style={{ background: isActive ? "var(--orange)" : "transparent" }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-medium leading-tight"
                       style={{ color: isActive ? "var(--text-primary)" : "var(--text-secondary)" }}>
                      {m.name}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{m.desc}</p>
                  </div>
                  {exhausted && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                          style={{ background: "rgba(248,113,113,0.15)", color: "var(--red)" }}>
                      MAX
                    </span>
                  )}
                </button>
              );
            })}
            <div className="h-1.5" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main input card ────────────────────────────────────────────────── */}
      <div
        className="relative transition-all duration-300 ease-out group"
        style={{
          background: focused ? "rgba(255,255,255,0.03)" : "var(--bg-raised)",
          borderRadius: "20px",
          border: "1px solid",
          borderColor: focused ? "rgba(255, 95, 31, 0.2)" : "rgba(255,255,255,0.06)",
          boxShadow: focused
            ? "0 0 0 1px rgba(255, 95, 31, 0.1), 0 20px 50px -12px rgba(0,0,0,0.5)"
            : "0 10px 30px -15px rgba(0,0,0,0.3)",
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
          placeholder="Message WUP..."
          className="w-full bg-transparent resize-none text-[15px] leading-relaxed placeholder:text-white/20"
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
              className="p-2.5 rounded-xl transition-all hover:bg-white/[0.05] hover:text-white/60 active:scale-95"
              style={{ color: "var(--text-muted)" }}
              title="Attach context"
            >
              <Paperclip size={16} />
            </button>

            <div className="w-[1px] h-4 bg-white/[0.06] mx-1" />

            {/* Model picker trigger */}
            <button
              onClick={() => setModelOpen(o => !o)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-bold tracking-wide uppercase transition-all hover:bg-white/[0.05]"
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
          </div>

          {/* Right — send */}
          <motion.button
            onClick={submit}
            disabled={!canSend}
            whileHover={canSend ? { scale: 1.05 } : {}}
            whileTap={canSend ? { scale: 0.95 } : {}}
            className="w-10 h-10 flex items-center justify-center rounded-2xl transition-all shadow-lg"
            style={{
              background: canSend ? "#ff5f1f" : "rgba(255,255,255,0.04)",
              color: canSend ? "#000" : "rgba(255,255,255,0.1)",
              cursor: canSend ? "pointer" : "not-allowed",
              boxShadow: canSend ? "0 0 15px rgba(255, 95, 31, 0.3)" : "none"
            }}
          >
            <ArrowUp size={18} strokeWidth={3} />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
