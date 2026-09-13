"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, Sparkles, Cpu, Layers, HelpCircle, 
  ArrowRight, ShieldCheck, Zap, BrainCircuit,
  Globe, Users, Link, ChevronRight, ChevronLeft, CheckCircle2
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";

interface DeepResearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PHASES = [
  {
    id: 1,
    tabLabel: "01. Reasoning",
    phase: "Phase 1",
    title: "Structured Reasoning",
    status: "In Progress",
    icon: <BrainCircuit className="w-5 h-5" />,
    desc: "Decomposes complex inquiries into sequential sub-tasks with real-time feedback loops.",
    bullets: [
      "Plan-and-Execute Loop breaks queries down to avoid hallucination.",
      "Tool dispatch via MCP connects context directly to search.",
      "Scratchpad keeps track of facts across multi-turn reasoning steps."
    ],
    visual: (
      <div className="font-mono text-[10px] space-y-1.5 p-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-highlight)] text-[var(--text-secondary)]">
        <div className="flex items-center gap-1.5 text-[var(--orange)] font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--orange)] animate-pulse" />
          <span>[PLANNING LOOP]</span>
        </div>
        <div className="opacity-90 pl-3">↳ Task 1: Fetch sales database</div>
        <div className="opacity-90 pl-3">↳ Task 2: Ground against Q2 PDF</div>
        <div className="text-emerald-500 font-bold mt-2">✓ Plan complete. Synthesizing report...</div>
      </div>
    )
  },
  {
    id: 2,
    tabLabel: "02. Routing",
    phase: "Phase 2",
    title: "Cost-Aware Dispatch",
    status: "Coming Soon",
    icon: <Zap className="w-5 h-5" />,
    desc: "Cascades inquiries dynamically to ensure high intelligence at lowest possible cost.",
    bullets: [
      "Gemini Flash handles easy Q&A and instant formatting.",
      "DeepSeek R1 escalates when deep math or coding is needed.",
      "Ensures maximum cognitive depth at up to 90% lower API cost."
    ],
    visual: (
      <div className="space-y-2 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-highlight)]">
        <div className="flex justify-between items-center text-[10px] text-[var(--text-muted)] font-mono">
          <span>QUERY CATEGORY</span>
          <span>ROUTING TO</span>
        </div>
        <div className="flex justify-between items-center p-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-overlay)] text-[11px]">
          <span className="font-medium">Simple formatting</span>
          <span className="text-zinc-400 font-mono text-[9px] bg-zinc-500/10 px-1.5 py-0.5 rounded">Gemini Flash</span>
        </div>
        <div className="flex justify-between items-center p-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-overlay)] text-[11px]">
          <span className="font-medium">Complex database synthesis</span>
          <span className="text-[var(--orange)] font-mono text-[9px] bg-[var(--orange-dim)] px-1.5 py-0.5 rounded">DeepSeek R1</span>
        </div>
      </div>
    )
  },
  {
    id: 3,
    tabLabel: "03. Deep Search",
    phase: "Phase 3",
    title: "Deep Research Core",
    status: "Coming Soon",
    icon: <Globe className="w-5 h-5" />,
    desc: "Performs iterative web crawls and source validation to deliver cited intelligence.",
    bullets: [
      "Runs multi-turn web search loops to check source authority.",
      "Builds a comprehensive Citation Graph mapping claims to rows.",
      "Generates academic-grade markdown and PDF report exports."
    ],
    visual: (
      <div className="font-mono text-[10px] space-y-1.5 p-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-highlight)] text-[var(--text-secondary)]">
        <div className="text-zinc-400 font-bold">[CRAWLER PIPELINE]</div>
        <div className="flex items-center gap-2 pl-3">
          <span className="w-1 h-1 rounded-full bg-zinc-400" />
          <span>Search: 'Q2 performance tech stocks'</span>
        </div>
        <div className="flex items-center gap-2 pl-3 text-emerald-500">
          <span>✓ Found 14 sources, synthesized 3 key citations</span>
        </div>
        <div className="mt-2 text-[9px] text-[var(--text-muted)] border-t border-[var(--border)] pt-1.5">
          Confidence Score: 98.4%
        </div>
      </div>
    )
  },
  {
    id: 4,
    tabLabel: "04. Sub-Agents",
    phase: "Phase 4",
    title: "Collaborative Agents",
    status: "Coming Soon",
    icon: <Users className="w-5 h-5" />,
    desc: "Spawns specialized worker agents that share context to complete workflows.",
    bullets: [
      "Coordinator Agent distributes tasks to research workers.",
      "Shared Context Database avoids redundant search indexing.",
      "Safeguarded by Human-in-the-Loop approval checkpoints."
    ],
    visual: (
      <div className="space-y-2 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-highlight)] text-[11px]">
        <div className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
          <Users size={12} className="text-[var(--orange)]" />
          <span>Agent Tree</span>
        </div>
        <div className="pl-3 border-l border-[var(--border)] space-y-1">
          <div className="text-[10px] font-mono p-1 rounded bg-[var(--bg-overlay)] border border-[var(--border)]">
            ├── Researcher (Web Analyst)
          </div>
          <div className="text-[10px] font-mono p-1 rounded bg-[var(--bg-overlay)] border border-[var(--border)]">
            └── Database Clerk (MCP Broker)
          </div>
        </div>
      </div>
    )
  },
  {
    id: 5,
    tabLabel: "05. Integrations",
    phase: "Phase 5",
    title: "Platform Integrations",
    status: "Coming Soon",
    icon: <Link className="w-5 h-5" />,
    desc: "Bridges research outcomes directly into Slack channels and Notion folders.",
    bullets: [
      "MCP triggers: Start research sessions from Slack conversations.",
      "Scheduled Agents run checks daily and export to Notion tables.",
      "API-first integration grants programmatic control over runs."
    ],
    visual: (
      <div className="flex items-center justify-around p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-highlight)] text-[11px]">
        <div className="flex flex-col items-center gap-1">
          <span className="p-2 rounded-lg bg-[var(--bg-overlay)] border border-[var(--border)] text-zinc-400 font-bold font-mono">S</span>
          <span className="text-[9px] text-[var(--text-muted)]">Slack</span>
        </div>
        <div className="w-8 h-px border-t border-dashed border-[var(--border)]" />
        <div className="flex flex-col items-center gap-1">
          <span className="p-2 rounded-lg bg-[var(--bg-overlay)] border border-[var(--border)] text-[var(--orange)]"><Cpu size={12} /></span>
          <span className="text-[9px] font-semibold text-[var(--orange)] font-mono">WUP</span>
        </div>
        <div className="w-8 h-px border-t border-dashed border-[var(--border)]" />
        <div className="flex flex-col items-center gap-1">
          <span className="p-2 rounded-lg bg-[var(--bg-overlay)] border border-[var(--border)] text-zinc-400 font-bold font-mono">N</span>
          <span className="text-[9px] text-[var(--text-muted)]">Notion</span>
        </div>
      </div>
    )
  }
];

export function DeepResearchModal({ isOpen, onClose }: DeepResearchModalProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const [activeTab, setActiveTab] = useState(0);

  const currentPhase = PHASES[activeTab];

  const handleNext = () => {
    if (activeTab < PHASES.length - 1) setActiveTab(t => t + 1);
  };

  const handlePrev = () => {
    if (activeTab > 0) setActiveTab(t => t - 1);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100]"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed z-[101] inset-0 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="w-full max-w-xl pointer-events-auto rounded-3xl overflow-hidden border flex flex-col"
              style={{
                background: "var(--bg-overlay)",
                borderColor: "var(--border)",
                boxShadow: isLight ? "0 12px 35px rgba(0,0,0,0.06)" : "0 24px 50px -12px rgba(0,0,0,0.8)"
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)] shrink-0">
                <div>
                  <h3 className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">
                    Deep Research Agent
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    Multi-step autonomous exploration & database grounding engine
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Phase Switcher Tabs */}
              <div className="px-6 pt-4 border-b border-[var(--border)] shrink-0">
                <div className="flex justify-between gap-1 overflow-x-auto scrollbar-hide pb-2">
                  {PHASES.map((p, idx) => {
                    const isActive = idx === activeTab;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setActiveTab(idx)}
                        className="relative px-3 py-1.5 text-[11px] font-medium rounded-lg transition-colors cursor-pointer shrink-0"
                        style={{
                          color: isActive ? "var(--orange)" : "var(--text-secondary)"
                        }}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="activeTabPill"
                            className="absolute inset-0 rounded-lg -z-10"
                            style={{
                              background: "var(--orange-dim)",
                              border: "1px solid rgba(37,99,235,0.15)"
                            }}
                            transition={{ type: "spring", stiffness: 350, damping: 30 }}
                          />
                        )}
                        {p.tabLabel}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Content Panel */}
              <div className="p-6 min-h-[300px] flex flex-col justify-between">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.22 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start"
                  >
                    {/* Left Column: Text & Bullets */}
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] bg-[var(--bg-highlight)] px-2 py-0.5 rounded border border-[var(--border)]">
                            {currentPhase.phase}
                          </span>
                          <span
                            className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                              currentPhase.status === "In Progress"
                                ? "bg-[var(--orange-dim)] text-[var(--orange)] border-blue-500/10"
                                : "bg-[var(--bg-highlight)] text-[var(--text-muted)] border-[var(--border)]"
                            }`}
                          >
                            {currentPhase.status}
                          </span>
                        </div>
                        <h4 className="text-[15px] font-semibold text-[var(--text-primary)]">
                          {currentPhase.title}
                        </h4>
                        <p className="text-[12px] leading-relaxed text-[var(--text-muted)] mt-1.5">
                          {currentPhase.desc}
                        </p>
                      </div>

                      <ul className="space-y-2">
                        {currentPhase.bullets.map((bullet, bIdx) => (
                          <li key={bIdx} className="flex items-start gap-2 text-[11.5px] text-[var(--text-secondary)] leading-relaxed">
                            <CheckCircle2 size={11} className="mt-1 shrink-0 text-[var(--orange)] opacity-80" />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Right Column: Visual representation */}
                    <div className="space-y-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        Live Preview Simulated
                      </p>
                      {currentPhase.visual}
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Navigation Footer */}
                <div className="mt-8 pt-4 border-t border-[var(--border)] flex items-center justify-between">
                  <div className="flex gap-1">
                    <button
                      onClick={handlePrev}
                      disabled={activeTab === 0}
                      className="p-2 rounded-xl border border-[var(--border)] bg-[var(--bg-overlay)] hover:bg-[var(--bg-highlight)] transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed text-[var(--text-secondary)]"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={handleNext}
                      disabled={activeTab === PHASES.length - 1}
                      className="p-2 rounded-xl border border-[var(--border)] bg-[var(--bg-overlay)] hover:bg-[var(--bg-highlight)] transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed text-[var(--text-secondary)]"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-[var(--text-muted)] font-medium">
                      Phase {currentPhase.id} of {PHASES.length}
                    </span>
                    <button
                      onClick={onClose}
                      className="px-4 py-2 rounded-xl text-[12px] font-semibold transition-all active:scale-[0.98] cursor-pointer text-white"
                      style={{ background: "var(--orange)", boxShadow: "0 0 16px rgba(37,99,235,0.2)" }}
                    >
                      Got It
                    </button>
                  </div>
                </div>

              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
