"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight } from "lucide-react";

interface ClarificationModalProps {
  question: string;
  options: string[];
  onSelect: (answer: string) => void;
  onDismiss: () => void;
}

export function ClarificationModal({ question, options, onSelect, onDismiss }: ClarificationModalProps) {
  const [customText, setCustomText] = useState("");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
      if (e.key === "Enter" && customText.trim()) {
        onSelect(customText.trim());
      }
      // Number keys 1-9 to select options
      const num = parseInt(e.key);
      if (num >= 1 && num <= options.length) {
        onSelect(options[num - 1]);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [options, customText, onSelect, onDismiss]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="w-full"
        style={{
          background: "rgba(18,18,18,0.98)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: "20px",
          boxShadow: "0 -4px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
          backdropFilter: "blur(20px)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 pt-4 pb-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
        >
          <p
            className="text-[13px] font-medium leading-relaxed tracking-wide flex-1 pr-4"
            style={{ color: "rgba(255,255,255,0.75)" }}
          >
            {question}
          </p>
          <button
            onClick={onDismiss}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/5 shrink-0"
            style={{ color: "rgba(255,255,255,0.2)" }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Options */}
        <div className="px-3 py-2">
          {options.map((option, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => onSelect(option)}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors duration-150"
              style={{
                background: hoveredIndex === i ? "rgba(255,255,255,0.05)" : "transparent",
                borderBottom: i < options.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
              }}
            >
              {/* Number badge */}
              <span
                className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors"
                style={{
                  background: hoveredIndex === i ? "rgba(255,95,31,0.15)" : "rgba(255,255,255,0.06)",
                  color: hoveredIndex === i ? "#ff5f1f" : "rgba(255,255,255,0.3)",
                  border: hoveredIndex === i ? "1px solid rgba(255,95,31,0.3)" : "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {i + 1}
              </span>
              <span
                className="text-[13px] font-medium flex-1"
                style={{ color: hoveredIndex === i ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.5)" }}
              >
                {option}
              </span>
              {hoveredIndex === i && (
                <ArrowRight size={12} style={{ color: "rgba(255,95,31,0.6)" }} />
              )}
            </motion.button>
          ))}
        </div>

        {/* Custom input */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
        >
          <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ color: "rgba(255,255,255,0.15)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </div>
          <input
            ref={inputRef}
            value={customText}
            onChange={e => setCustomText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && customText.trim()) onSelect(customText.trim()); }}
            placeholder="Something else..."
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-[rgba(255,255,255,0.15)] tracking-wide"
            style={{ color: "rgba(255,255,255,0.6)" }}
          />
          {customText.trim() && (
            <button
              onClick={() => onSelect(customText.trim())}
              className="px-3 py-1 rounded-lg text-[11px] font-bold transition-colors"
              style={{ background: "#ff5f1f", color: "#000" }}
            >
              Skip
            </button>
          )}
          {!customText.trim() && (
            <span className="text-[10px] tracking-widest font-bold" style={{ color: "rgba(255,255,255,0.12)" }}>
              Esc to skip
            </span>
          )}
        </div>

        {/* Keyboard hint */}
        <div
          className="px-4 pb-3 flex items-center gap-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}
        >
          <span className="text-[9px] tracking-[0.15em] uppercase" style={{ color: "rgba(255,255,255,0.1)" }}>
            ↑↓ navigate · Enter to select · Esc to skip
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
