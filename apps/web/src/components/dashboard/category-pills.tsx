"use client";

import React from "react";
import { BarChart3, Database, FileText, BrainCircuit } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme-provider";

const suggestions = [
  {
    icon: <BarChart3 size={15} />,
    label: "Analyze sales",
    sub: "Query your database for trends",
  },
  {
    icon: <FileText size={15} />,
    label: "Summarize a PDF",
    sub: "Extract key insights from a document",
  },
  {
    icon: <Database size={15} />,
    label: "Query MongoDB",
    sub: "Explore your bridged collections",
  },
  {
    icon: <BrainCircuit size={15} />,
    label: "Brain insights",
    sub: "Ask anything about your data",
  },
];

interface CategoryPillsProps {
  onSelect?: (label: string) => void;
}

export function CategoryPills({ onSelect }: CategoryPillsProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.4 }}
      className="grid grid-cols-2 gap-2 mt-4 w-full"
    >
      {suggestions.map((s, i) => (
        <motion.button
          key={s.label}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 + i * 0.05, duration: 0.3 }}
          onClick={() => onSelect?.(s.label)}
          className="group flex items-center gap-3 p-3.5 rounded-xl text-left transition-all duration-150 active:scale-[0.98] border cursor-pointer"
          style={{
            background: "var(--bg-raised)",
            borderColor: "var(--border)",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = isLight ? "rgba(37,99,235,0.04)" : "var(--orange-dim)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(37,99,235,0.25)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = "var(--bg-raised)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
          }}
        >
          {/* Icon */}
          <span
            className="shrink-0 transition-colors group-hover:text-[var(--orange)] text-zinc-500 dark:text-white/30"
          >
            {s.icon}
          </span>
          {/* Text */}
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-[var(--text-primary)] leading-tight truncate">{s.label}</p>
            <p className="text-[11px] mt-0.5 text-[var(--text-muted)] leading-snug truncate">{s.sub}</p>
          </div>
        </motion.button>
      ))}
    </motion.div>
  );
}
