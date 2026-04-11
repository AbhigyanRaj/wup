"use client";

import React from "react";
import { 
  BarChart3, 
  Database, 
  Table2, 
  Zap, 
  BrainCircuit 
} from "lucide-react";

export function CategoryPills() {
  const categories = [
    { icon: <BarChart3 size={14} />, label: "Analyze sales" },
    { icon: <Database size={14} />, label: "Query MongoDB" },
    { icon: <Zap size={14} />, label: "Supabase trends" },
    { icon: <Table2 size={14} />, label: "Sheets summary" },
    { icon: <BrainCircuit size={14} />, label: "Brain insights" },
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 mt-6 animate-in fade-in slide-in-from-bottom-2 duration-1000 delay-300">
      {categories.map((cat) => (
        <button
          key={cat.label}
          className="flex items-center gap-2 px-4 py-1.5 bg-white/[0.03] border border-white/5 rounded-full text-[11px] font-medium text-white/40 hover:text-white hover:bg-white/10 hover:border-white/10 transition-all active:scale-95 group"
        >
          <span className="text-white/20 group-hover:text-white/60 transition-colors">
            {cat.icon}
          </span>
          {cat.label}
        </button>
      ))}
    </div>
  );
}
