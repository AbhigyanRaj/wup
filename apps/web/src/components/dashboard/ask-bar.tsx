"use client";

import React, { useState, useRef } from "react";
import { 
  Plus, 
  Mic, 
  ChevronDown, 
  ArrowUp,
  Brain,
  Zap,
  Sparkles,
  Bot,
  AlertCircle
} from "lucide-react";

interface AskBarProps {
  onSubmit: (message: string, model: string) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  exhaustedModels?: string[];
}

export function AskBar({ 
  onSubmit, 
  selectedModel, 
  onModelChange, 
  exhaustedModels = [] 
}: AskBarProps) {
  const [active, setActive] = useState(false);
  const [modelDropdown, setModelDropdown] = useState(false);
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const models = [
    { id: "Auto-Rotate", name: "Auto-Rotate", desc: "Best available model", icon: <Sparkles size={14} className="text-amber-400" /> },
    { id: "gemini-3-flash-preview", name: "Gemini 3 Flash", desc: "Next-gen Intelligence", icon: <Bot size={14} className="text-purple-400" /> },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", desc: "Premium Efficiency", icon: <Brain size={14} className="text-blue-400" /> },
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", desc: "Fast & Balanced", icon: <Zap size={14} className="text-cyan-400" /> },
    { id: "gemini-flash-lite-latest", name: "Gemini Flash Lite", desc: "Ultra-fast Tasks", icon: <Zap size={14} className="text-green-400" /> },
  ];

  const handleSubmit = () => {
    if (!input.trim()) return;
    onSubmit(input, selectedModel);
    setInput("");
    setModelDropdown(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto group">
      <div className={`
        relative bg-[#0d0d0d] border border-white/5 rounded-[24px] lg:rounded-[28px] p-2 transition-all duration-500
        ${active ? "border-white/10 shadow-[0_0_60px_rgba(226,125,96,0.05)] ring-1 ring-white/5" : "hover:border-white/10 shadow-lg"}
      `}>
        {/* Main Input Area */}
        <div className="flex flex-col">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="How can the Brain help you today?"
            onFocus={() => setActive(true)}
            onBlur={() => setTimeout(() => setActive(false), 200)}
            className="w-full bg-transparent border-none focus:ring-0 text-white placeholder:text-white/20 px-4 pt-4 pb-14 lg:pb-12 resize-none font-light leading-relaxed text-[15px] lg:text-sm"
          />
          
          {/* Controls Bar */}
          <div className="absolute bottom-3 left-2 right-2 flex items-center justify-between">
            <div className="flex items-center gap-1 lg:gap-2 relative">
              <button className="p-2 hover:bg-white/5 rounded-full text-white/40 hover:text-white transition-all hidden sm:block">
                <Plus size={18} />
              </button>
              
              {/* Model Selector Style */}
              <div className="relative">
                <button 
                  onClick={() => setModelDropdown(!modelDropdown)}
                  className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-white/10 rounded-full border border-white/5 text-[10px] lg:text-[11px] font-medium text-white/60 hover:text-white transition-all group/model min-w-[100px]"
                >
                  <div className="flex items-center gap-2">
                    {models.find(m => m.id === selectedModel)?.icon || <Sparkles size={10} />}
                    {models.find(m => m.id === selectedModel)?.name || "Auto-Rotate"}
                  </div>
                  <ChevronDown size={10} className={`text-white/20 transition-transform ${modelDropdown ? "rotate-180" : ""}`} />
                </button>

                {modelDropdown && (
                  <div className="absolute top-full mt-2 left-0 w-56 sm:w-64 bg-[#121212] border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-2 z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-3 py-2 text-[10px] uppercase tracking-widest text-white/20 font-bold">Intelligence Core</div>
                    {models.map((m) => {
                      const isExhausted = exhaustedModels.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          disabled={isExhausted && m.id !== "Auto-Rotate"}
                          onClick={() => {
                            onModelChange(m.id);
                            setModelDropdown(false);
                          }}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all ${selectedModel === m.id ? "bg-white/10" : "hover:bg-white/5"} ${isExhausted ? "opacity-50 grayscale" : ""}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="text-white/40">{m.icon}</div>
                            <div className="text-left">
                              <p className={`text-[11px] lg:text-xs font-medium ${selectedModel === m.id ? "text-white" : "text-white/60"}`}>{m.name}</p>
                              <p className="text-[9px] text-white/20 font-light hidden sm:block">{m.desc}</p>
                            </div>
                          </div>
                          {isExhausted && (
                            <div className="flex items-center gap-1 text-[9px] text-red-400 font-bold bg-red-400/10 px-1.5 py-0.5 rounded-full">
                              <AlertCircle size={10} strokeWidth={3} />
                              EXT
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button className="p-2 hover:bg-white/5 rounded-full text-white/40 hover:text-white transition-all">
                <Mic size={18} />
              </button>
              <button 
                onClick={handleSubmit}
                disabled={!input.trim()}
                className={`p-2 bg-white/10 text-white rounded-full transition-all shadow-lg ${input.trim() ? "hover:bg-white hover:text-black opacity-100" : "opacity-20 cursor-not-allowed"}`}
              >
                <ArrowUp size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
