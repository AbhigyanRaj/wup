"use client";

import React, { useState } from "react";
import { 
  X, 
  Database, 
  Table2, 
  Zap, 
  Terminal, 
  CheckCircle2,
  Loader2,
  ChevronRight
} from "lucide-react";

interface ConnectDbModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConnectDbModal({ isOpen, onClose }: ConnectDbModalProps) {
  const [step, setStep] = useState<"choice" | "input" | "loading" | "success">("choice");
  const [selectedSource, setSelectedSource] = useState<{ name: string, icon: any } | null>(null);

  if (!isOpen) return null;

  const sources = [
    { name: "Google Sheets", icon: <Table2 size={20} />, description: "Spreadsheet context" },
    { name: "MongoDB", icon: <Database size={20} />, description: "NoSQL JSON Documents" },
    { name: "Supabase", icon: <Zap size={20} />, description: "Real-time PostgreSQL" },
    { name: "PostgreSQL", icon: <Terminal size={20} />, description: "Relational Database" },
  ];

  const handleConnect = () => {
    setStep("loading");
    setTimeout(() => setStep("success"), 1500);
    setTimeout(() => {
      onClose();
      setTimeout(() => {
        setStep("choice");
        setSelectedSource(null);
      }, 300);
    }, 3000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-[#0f0f0f] border border-white/[0.05] rounded-[24px] lg:rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
        <div className="p-6 sm:p-8">
          <div className="flex justify-between items-center mb-8 lg:mb-10">
            <h2 className="text-lg lg:text-xl font-medium tracking-tight text-white/90 font-serif italic">
              {step === "choice" && "Data Source"}
              {step === "input" && selectedSource?.name}
              {step === "loading" && "Connecting"}
              {step === "success" && "Success"}
            </h2>
            <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded-full text-white/20 hover:text-white transition-all">
              <X size={18} />
            </button>
          </div>

          {step === "choice" && (
            <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1 scrollbar-hide">
              {sources.map((source) => (
                <button
                  key={source.name}
                  onClick={() => {
                    setSelectedSource(source);
                    setStep("input");
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-white/[0.03] transition-all group text-left"
                >
                  <div className="flex-shrink-0 text-white/20 group-hover:text-white/80 transition-colors">
                    {source.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-medium text-white/60 group-hover:text-white transition-colors">{source.name}</h3>
                    <p className="text-[10px] text-white/10 font-light italic truncate">{source.description}</p>
                  </div>
                  <ChevronRight size={14} className="text-white/5 group-hover:text-white/20 transition-all transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          )}

          {step === "input" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="space-y-3">
                <p className="text-[10px] sm:text-[11px] text-white/20 font-light italic px-1 tracking-wide leading-relaxed">
                  Enter your connection string or environment key to bridge your {selectedSource?.name} data to the Brain.
                </p>
                <input 
                  autoFocus
                  type="password"
                  placeholder="Key or URL..."
                  className="w-full bg-white/[0.02] border border-white/5 rounded-xl py-3.5 px-5 text-sm font-light text-white placeholder:text-white/5 focus:border-white/10 transition-all outline-none"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={() => setStep("choice")}
                  className="w-full sm:w-auto px-6 py-3 border border-white/5 rounded-xl text-xs font-medium text-white/20 hover:text-white/60 transition-all order-2 sm:order-1"
                >
                  Back
                </button>
                <button 
                  onClick={handleConnect}
                  className="flex-1 py-3 bg-white text-black rounded-xl font-semibold text-xs hover:bg-white/90 active:scale-[0.98] transition-all shadow-sm order-1 sm:order-2"
                >
                  Confirm Connection
                </button>
              </div>
            </div>
          )}

          {step === "loading" && (
            <div className="py-12 flex flex-col items-center justify-center gap-4 animate-in fade-in duration-500">
              <Loader2 className="w-8 h-8 text-white/10 animate-spin" />
              <p className="text-[11px] font-light text-white/20 tracking-widest italic">Syncing Protocol...</p>
            </div>
          )}

          {step === "success" && (
            <div className="py-12 flex flex-col items-center justify-center gap-4 animate-in zoom-in-95 duration-700">
              <div className="w-12 h-12 bg-white/[0.03] border border-white/5 rounded-full flex items-center justify-center text-white/40">
                <CheckCircle2 size={24} />
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-white/80 italic mb-1">Bridge Active</p>
                <p className="text-[10px] text-white/10 font-light">Data integration complete.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
