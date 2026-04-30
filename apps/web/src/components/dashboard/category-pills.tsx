"use client";

import React from "react";
import { BarChart3, Database, FileText, Zap, BrainCircuit } from "lucide-react";
import { motion } from "framer-motion";

const suggestions = [
  {
    icon: <BarChart3 size={14} />,
    label: "Analyze sales",
    sub: "Query your database for trends",
  },
  {
    icon: <FileText size={14} />,
    label: "Summarize a PDF",
    sub: "Extract key insights from a document",
  },
  {
    icon: <Database size={14} />,
    label: "Query MongoDB",
    sub: "Explore your bridged collections",
  },
  {
    icon: <BrainCircuit size={14} />,
    label: "Brain insights",
    sub: "Ask anything about your data",
  },
];

interface CategoryPillsProps {
  onSelect?: (label: string) => void;
}

export function CategoryPills({ onSelect }: CategoryPillsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.4 }}
      className="grid grid-cols-2 gap-2.5 mt-6 w-full"
    >
      {suggestions.map((s, i) => (
        <motion.button
          key={s.label}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 + i * 0.05, duration: 0.3 }}
          onClick={() => onSelect?.(s.label)}
          className="group flex flex-col items-start gap-1.5 p-3.5 rounded-xl text-left transition-all duration-150 active:scale-[0.98]"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)";
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.4)" }} className="transition-colors group-hover:text-white/60">
            {s.icon}
          </span>
          <div>
            <p className="text-[13px] font-medium text-white/80 leading-tight">{s.label}</p>
            <p className="text-[11.5px] mt-0.5 text-white/35 leading-snug">{s.sub}</p>
          </div>
        </motion.button>
      ))}
    </motion.div>
  );
}
