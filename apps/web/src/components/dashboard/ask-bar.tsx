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
  Bot
} from "lucide-react";

interface AskBarProps {
  onSubmit: (message: string) => void;
}

export function AskBar({ onSubmit }: AskBarProps) {
  const [active, setActive] = useState(false);
  const [modelDropdown, setModelDropdown] = useState(false);
  const [selectedModel, setSelectedModel] = useState("Sonnet 4.6");
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const models = [
    { name: "Sonnet 4.6", desc: "Balanced & Data-Smart", icon: <Brain size={14} /> },
    { name: "GPT-4o", desc: "Reasoning Powerhouse", icon: <Bot size={14} /> },
    { name: "Haiku 4.0", desc: "Fast & Precise", icon: <Zap size={14} /> },
    { name: "DeepSeek V3", desc: "In-depth Discovery", icon: <Sparkles size={14} /> },
  ];

  const handleSubmit = () => {
    if (!input.trim()) return;
    onSubmit(input);
    setInput("");
    // Collapse mobile UI after sending
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
                  className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-white/10 rounded-full border border-white/5 text-[10px] lg:text-[11px] font-medium text-white/60 hover:text-white transition-all group/model"
                >
                  {selectedModel}
                  <ChevronDown size={10} className={`text-white/20 transition-transform ${modelDropdown ? "rotate-180" : ""}`} />
                </button>

                {modelDropdown && (
                  <div className="absolute top-full mt-2 left-0 w-48 sm:w-56 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl p-2 z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-3 py-2 text-[10px] uppercase tracking-widest text-white/20 font-bold">Select Model</div>
                    {models.map((m) => (
                      <button
                        key={m.name}
                        onClick={() => {
                          setSelectedModel(m.name);
                          setModelDropdown(false);
                        }}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-left transition-all ${selectedModel === m.name ? "bg-white/5" : ""}`}
                      >
                        <div className="text-white/40">{m.icon}</div>
                        <div>
                          <p className={`text-[11px] lg:text-xs font-medium ${selectedModel === m.name ? "text-white" : "text-white/60"}`}>{m.name}</p>
                          <p className="text-[10px] text-white/20 font-light hidden sm:block">{m.desc}</p>
                        </div>
                      </button>
                    ))}
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
