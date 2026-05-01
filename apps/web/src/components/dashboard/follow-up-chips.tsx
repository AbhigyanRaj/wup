"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";

interface FollowUp {
  label: string;
  suggestedPrompt: string;
}

interface FollowUpChipsProps {
  followUps: FollowUp[];
  onSelect: (prompt: string) => void;
}

export function FollowUpChips({ followUps, onSelect }: FollowUpChipsProps) {
  if (!followUps || followUps.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="flex flex-col gap-2 mt-5 pt-4"
        style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <Sparkles size={9} style={{ color: "rgba(255,95,31,0.5)" }} />
          <span
            className="text-[9px] font-bold uppercase tracking-[0.2em] select-none"
            style={{ color: "rgba(255,255,255,0.15)" }}
          >
            Continue exploring
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {followUps.map((fu, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.25 + i * 0.07 }}
              onClick={() => onSelect(fu.suggestedPrompt)}
              className="group flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-[12px] font-medium transition-all duration-200 active:scale-[0.97]"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                color: "rgba(255,255,255,0.4)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,95,31,0.06)";
                e.currentTarget.style.borderColor = "rgba(255,95,31,0.25)";
                e.currentTarget.style.color = "rgba(255,255,255,0.75)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
                e.currentTarget.style.color = "rgba(255,255,255,0.4)";
              }}
            >
              {fu.label}
            </motion.button>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
