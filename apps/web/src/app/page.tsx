"use client";

import Link from "next/link";
import { ArrowRight, Database, FileText, Globe, Zap, Key, Check, Sun, Moon, RefreshCw } from "lucide-react";
import { SiMongodb, SiGooglesheets, SiPostgresql } from "react-icons/si";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useTheme } from "@/components/theme-provider";

// ─── Animated terminal demo ───────────────────────────────────────────────────

const DEMO_LINES = [
  { delay: 0,    type: "prompt",  text: "Show me top 5 customers by revenue this month" },
  { delay: 1200, type: "status",  text: "Querying MongoDB · customers collection..." },
  { delay: 2200, type: "status",  text: "Aggregating pipeline · grouping by userId..." },
  { delay: 3100, type: "result",  text: "Found 847 documents · filtered to top 5" },
  { delay: 3800, type: "answer",  text: "Here are your top customers for May 2026:" },
  { delay: 4400, type: "table",   text: "" },
];

const TABLE_ROWS = [
  ["Acme Corp",      "$124,820", "↑ 34%"],
  ["GlobalTech",     "$98,400",  "↑ 12%"],
  ["NovaBuild",      "$87,900",  "↑ 28%"],
  ["Stratos Inc",    "$71,200",  "↓ 4%"],
  ["BlueSky Labs",   "$65,500",  "↑ 19%"],
];

function TerminalDemo() {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const [visibleLines, setVisibleLines] = useState<number[]>([]);

  useEffect(() => {
    DEMO_LINES.forEach((line, i) => {
      const timer = setTimeout(() => {
        setVisibleLines(prev => [...prev, i]);
      }, line.delay);
      return () => clearTimeout(timer);
    });
  }, []);

  return (
    <div
      className="w-full rounded-2xl overflow-hidden shadow-2xl relative transition-all duration-300"
      style={{
        background: isLight ? "#ffffff" : "#08080a",
        border: isLight ? "1px solid rgba(20,24,38,0.06)" : "1px solid rgba(255,255,255,0.07)",
        boxShadow: isLight 
          ? "0 20px 45px -10px rgba(20,24,38,0.05), 0 0 0 1px rgba(20,24,38,0.01)" 
          : "0 30px 60px -15px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.02)",
      }}
    >
      {/* Title bar */}
      <div 
        className="flex items-center gap-2 px-4 py-3 border-b transition-colors" 
        style={{ 
          background: isLight ? "rgba(20,24,38,0.015)" : "rgba(255,255,255,0.01)",
          borderColor: isLight ? "rgba(20,24,38,0.05)" : "rgba(255,255,255,0.05)"
        }}
      >
        <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56] opacity-90 hover:opacity-100 transition-opacity" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e] opacity-90 hover:opacity-100 transition-opacity" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f] opacity-90 hover:opacity-100 transition-opacity" />
        <span className={`ml-3 text-[10px] font-mono tracking-wider transition-colors ${isLight ? "text-zinc-400" : "text-zinc-500"}`}>wuup — terminal</span>
      </div>

      {/* Content */}
      <div className="p-6 space-y-3.5 min-h-[290px] font-mono text-[12px] leading-relaxed">
        {DEMO_LINES.map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 4 }}
            animate={visibleLines.includes(i) ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.25 }}
          >
            {line.type === "prompt" && (
              <div className="flex items-start gap-2">
                <span className="text-[#2563eb] font-bold">›</span>
                <span className={`transition-colors ${isLight ? "text-zinc-800 font-semibold" : "text-zinc-100"}`}>{line.text}</span>
              </div>
            )}
            {line.type === "status" && (
              <div className={`flex items-center gap-2 transition-colors ${isLight ? "text-zinc-600 font-medium" : "text-zinc-500"}`}>
                <div className="w-1.5 h-1.5 rounded-full bg-[#2563eb] animate-pulse" />
                <span>{line.text}</span>
              </div>
            )}
            {line.type === "result" && (
              <div className={`transition-colors font-medium ${isLight ? "text-emerald-600 font-semibold" : "text-emerald-500"}`}>✓ {line.text}</div>
            )}
            {line.type === "answer" && (
              <div className={`pt-1 transition-colors ${isLight ? "text-zinc-800 font-medium" : "text-zinc-200"}`}>{line.text}</div>
            )}
            {line.type === "table" && (
              <div className={`mt-2.5 rounded-xl overflow-hidden border transition-colors ${
                isLight ? "border-zinc-300 bg-zinc-50/50" : "border-white/[0.05] bg-zinc-950/40"
              }`}>
                <table className="w-full text-left">
                  <thead>
                    <tr style={{ background: isLight ? "rgba(20,24,38,0.015)" : "rgba(255,255,255,0.015)" }}>
                      {["Customer", "Revenue", "Growth"].map(h => (
                        <th key={h} className={`px-4 py-2.5 text-[9px] font-bold uppercase tracking-widest transition-colors ${
                          isLight ? "text-zinc-500 font-semibold" : "text-zinc-500"
                        }`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TABLE_ROWS.map(([name, rev, change], ri) => (
                      <tr 
                        key={ri} 
                        className={`border-t transition-colors ${
                          isLight ? "border-zinc-200 hover:bg-zinc-200/20" : "border-white/[0.04] hover:bg-white/[0.01]"
                        }`}
                      >
                        <td className={`px-4 py-2 transition-colors ${isLight ? "text-zinc-800 font-medium" : "text-zinc-300"}`}>{name}</td>
                        <td className="px-4 py-2 font-semibold text-[#2563eb]">{rev}</td>
                        <td className="px-4 py-2 text-emerald-600 dark:text-emerald-500 font-medium">{change}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        ))}

        {/* Blinking cursor */}
        {visibleLines.length >= DEMO_LINES.length && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ repeat: Infinity, duration: 1 }}
            className="w-1.5 h-3.5 rounded-sm mt-1"
            style={{ background: "#2563eb" }}
          />
        )}
      </div>
    </div>
  );
}

interface QueryOption {
  id: string;
  tag: string;
  query: string;
  plan: string[];
  steps: {
    title: string;
    log: string;
    code?: string;
  }[];
  answer: string;
  citations: string[];
}

const AGENTIC_QUERIES: QueryOption[] = [
  {
    id: "query-1",
    tag: "Multi-Source Analysis",
    query: "Cross-reference recent active contracts in PDF Vault with MongoDB revenue logs",
    plan: ["Intent Dissection", "PDF Semantic Search", "MongoDB Aggregation", "Grounded Synthesis"],
    steps: [
      {
        title: "Intent Dissection",
        log: "User request parsed. Identified task: join unstructured contract parameters with structured transaction tables.",
        code: '{\n  "intent": "JOIN_UNSTRUCTURED_STRUCTURED",\n  "sources": ["pdf_vault", "mongodb.transactions"],\n  "keys": ["companyName", "activeCohort"]\n}'
      },
      {
        title: "PDF Vector Retrieval",
        log: "Scanning PDF Vault index with cosine similarity. Matched 3 active contract parameters.",
        code: "Matched: Acme_Corp_Addendum_2026.pdf (Similarity: 0.948)\n-> Extraction: Cohort='Enterprise', SLA='99.9%', Discount='15%'"
      },
      {
        title: "MongoDB Live Pipeline",
        log: "Aggregating MongoDB collection 'transactions' matching Enterprise company cohort.",
        code: "db.transactions.aggregate([\n  { $match: { company: 'Acme Corp', status: 'active' } },\n  { $group: { _id: '$cohort', totalRevenue: { $sum: '$amount' } } }\n])\n\n// Result: totalRevenue = $124,820"
      },
      {
        title: "Synthesis & Grounding",
        log: "Integrating PDF SLA commitments with MongoDB live transaction amounts. Synthesizing citations.",
        code: "Checking constraints...\n- Citation [1] verified against pdf://Acme_Corp_Addendum_2026.pdf\n- Citation [2] verified against mongodb://transactions/acme"
      }
    ],
    answer: "Based on the recent active addendum contract [1] and the aggregated transactional database log [2], Acme Corp has logged a total revenue of $124,820 under the Enterprise cohort. Their contract SLA commitment is 99.9% uptime with an active 15% rate discount applied.",
    citations: ["Acme_Corp_Addendum_2026.pdf (p. 3)", "mongodb://transactions/acme_corp"]
  },
  {
    id: "query-2",
    tag: "Real-time Intelligence",
    query: "Verify invoice pricing in Sheets against live market prices using Web Agent",
    plan: ["Sheets Ledger Scan", "Web Retrieval", "Validation Audit", "Synthesis & Cite"],
    steps: [
      {
        title: "Sheets Data Parsing",
        log: "Scanning active Google Sheets invoice ledger. Extracted 2 target rows for price verification.",
        code: "Row 12: 'AMD Ryzen 9 9950X' - Listed Price: $649.00\nRow 13: 'NVIDIA RTX 5090' - Listed Price: $1,999.00"
      },
      {
        title: "Live Web Search",
        log: "Dispatched Web Agent queries to fetch real-time merchant endpoints.",
        code: "GET https://api.openrouter.ai/api/v1/chat/completions\nQuery: 'Current average retail price for AMD Ryzen 9 9950X and NVIDIA RTX 5090'\n\nResponse 200 OK: Average Retail Prices found."
      },
      {
        title: "Pricing Validation Audit",
        log: "Cross-referencing Sheets listed prices with extracted real-time web averages.",
        code: "- AMD Ryzen 9 9950X: listed=$649.00, web=$629.00 (Difference: +$20.00)\n- NVIDIA RTX 5090: listed=$1,999.00, web=$1,999.00 (Difference: $0.00)"
      },
      {
        title: "Synthesis & Citation Setup",
        log: "Formatting audit result logs. Compiling real-time citations from web endpoints.",
        code: "Audit passed.\n- Web Citation [1]: retail-prices.com/cpu/9950x\n- Web Citation [2]: nvidia.com/en-us/rtx5090"
      }
    ],
    answer: "Pricing verification audit complete. The listed price for the NVIDIA RTX 5090 in Google Sheets is accurate at $1,999.00 compared to average retail prices [2]. However, the AMD Ryzen 9 9950X is listed at $649.00, which is $20.00 higher than the current average web market price of $629.00 [1].",
    citations: ["retail-prices.com/cpu/9950x", "nvidia.com/en-us/rtx5090"]
  }
];

function AgenticExecutionSandbox() {
  const { theme } = useTheme();
  const isLight = theme === "light";
  
  const [selectedId, setSelectedId] = useState("query-1");
  const [activeStep, setActiveStep] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [streamedAnswer, setStreamedAnswer] = useState("");
  const [runKey, setRunKey] = useState(0);

  const query = AGENTIC_QUERIES.find(q => q.id === selectedId) || AGENTIC_QUERIES[0];

  useEffect(() => {
    // Reset state whenever query switches or sandbox triggers execution
    setActiveStep(0);
    setStreamedAnswer("");
    setIsTyping(false);

    let stepTimer1: NodeJS.Timeout;
    let stepTimer2: NodeJS.Timeout;
    let stepTimer3: NodeJS.Timeout;
    let streamTimer: NodeJS.Timeout;

    // Simulate Step-by-Step execution pipeline
    stepTimer1 = setTimeout(() => {
      setActiveStep(1);
    }, 1200);

    stepTimer2 = setTimeout(() => {
      setActiveStep(2);
    }, 2400);

    stepTimer3 = setTimeout(() => {
      setActiveStep(3);
    }, 3600);

    // Trigger Streaming output
    stepTimer3 = setTimeout(() => {
      setActiveStep(4);
      setIsTyping(true);
      
      let charIndex = 0;
      const fullAnswer = query.answer;
      
      const typeFn = () => {
        if (charIndex <= fullAnswer.length) {
          setStreamedAnswer(fullAnswer.slice(0, charIndex));
          charIndex += 2; // Stream 2 characters at a time for modern speed
          streamTimer = setTimeout(typeFn, 25);
        } else {
          setIsTyping(false);
        }
      };
      typeFn();
    }, 4500);

    return () => {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);
      clearTimeout(streamTimer);
    };
  }, [selectedId, runKey]);

  return (
    <div 
      className={`w-full p-6 sm:p-8 rounded-3xl border transition-all duration-300 relative overflow-hidden flex flex-col gap-8 ${
        isLight 
          ? "border-zinc-200 bg-white shadow-[0_12px_45px_rgba(20,24,38,0.02)]" 
          : "border-white/[0.05] bg-white/[0.015] backdrop-blur-md"
      }`}
    >
      {/* Glow elements */}
      <div className="absolute top-0 right-0 w-[300px] h-[300px] pointer-events-none"
        style={{ background: isLight ? "radial-gradient(circle, rgba(37,99,235,0.01) 0%, transparent 70%)" : "radial-gradient(circle, rgba(37,99,235,0.02) 0%, transparent 70%)" }} />

      {/* Grid selector buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6 transition-colors border-zinc-200/50 dark:border-white/[0.04]">
        <div className="flex flex-col gap-1">
          <span className="text-[8px] tracking-[0.25em] font-extrabold uppercase text-[#2563eb]">Interactive Sandbox</span>
          <h3 className={`text-[15px] font-semibold transition-colors ${isLight ? "text-zinc-900" : "text-white"}`}>Select Agent Query Case</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {AGENTIC_QUERIES.map(q => {
            const isSelected = q.id === selectedId;
            return (
              <button
                key={q.id}
                onClick={() => setSelectedId(q.id)}
                className={`px-4 py-2 rounded-full text-[11px] font-bold tracking-wide transition-all cursor-pointer border ${
                  isSelected
                    ? "bg-[#2563eb] text-white border-[#2563eb] shadow-md shadow-[#2563eb]/15"
                    : isLight
                      ? "bg-zinc-100/80 hover:bg-zinc-100 border-zinc-200 text-zinc-600"
                      : "bg-white/[0.02] hover:bg-white/[0.05] border-white/[0.08] text-zinc-300"
                }`}
              >
                {q.tag}
              </button>
            );
          })}
          <button
            onClick={() => setRunKey(k => k + 1)}
            className={`p-2 rounded-full border transition-all cursor-pointer flex items-center justify-center ${
              isLight 
                ? "bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-700" 
                : "bg-white/[0.02] hover:bg-white/[0.05] border-white/[0.08] text-zinc-300"
            }`}
            title="Restart Execution"
          >
            <RefreshCw size={12} className={activeStep < 4 || isTyping ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Pipeline Graph */}
        <div className="lg:col-span-5 space-y-6">
          <div className={`p-5 rounded-2xl border transition-colors ${
            isLight ? "bg-zinc-50/50 border-zinc-200/80" : "bg-white/[0.01] border-white/[0.04]"
          }`}>
            <h4 className={`text-[12px] font-bold uppercase tracking-wider mb-5 transition-colors ${isLight ? "text-zinc-800" : "text-zinc-200"}`}>Orchestrator Execution Plan</h4>
            <div className="relative pl-6 space-y-6 border-l border-zinc-200 dark:border-white/[0.06]">
              {query.steps.map((step, idx) => {
                const isPast = activeStep > idx;
                const isCurrent = activeStep === idx;
                
                return (
                  <div key={idx} className="relative">
                    {/* Node status ring */}
                    <div className={`absolute -left-[30px] top-0.5 w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                      isPast 
                        ? "bg-[#2563eb] border-[#2563eb] text-white shadow-[0_0_8px_rgba(37,99,235,0.4)]"
                        : isCurrent
                          ? "bg-white dark:bg-zinc-950 border-[#2563eb] animate-pulse"
                          : isLight
                            ? "bg-zinc-100 border-zinc-300"
                            : "bg-zinc-900 border-white/[0.08]"
                    }`}>
                      {isPast ? (
                        <Check size={8} className="stroke-[3]" />
                      ) : (
                        <div className={`w-1.5 h-1.5 rounded-full ${isCurrent ? "bg-[#2563eb]" : "bg-transparent"}`} />
                      )}
                    </div>
                    
                    <div>
                      <p className={`text-[12px] font-bold transition-colors ${
                        isCurrent 
                          ? "text-[#2563eb]" 
                          : isPast 
                            ? isLight ? "text-zinc-900" : "text-zinc-200"
                            : "text-zinc-400"
                      }`}>{step.title}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2 leading-relaxed">{step.log}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side: Visual Sandbox Log Panel */}
        <div className="lg:col-span-7 space-y-4">
          <div 
            className="w-full rounded-2xl overflow-hidden shadow-xl border transition-all duration-300"
            style={{
              background: isLight ? "#ffffff" : "#08080a",
              borderColor: isLight ? "rgba(20,24,38,0.06)" : "rgba(255,255,255,0.06)",
            }}
          >
            {/* Title Bar */}
            <div 
              className="flex items-center justify-between px-4 py-3 border-b transition-colors"
              style={{
                background: isLight ? "rgba(20,24,38,0.015)" : "rgba(255,255,255,0.01)",
                borderColor: isLight ? "rgba(20,24,38,0.05)" : "rgba(255,255,255,0.05)"
              }}
            >
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
              </div>
              <span className={`text-[10px] font-mono tracking-wider transition-colors ${isLight ? "text-zinc-500 font-semibold" : "text-zinc-500"}`}>
                wuup — orchestrator.log
              </span>
              <div className="w-10" />
            </div>

            {/* Inner Workspace content */}
            <div className="p-5 font-mono space-y-4 text-[12px] leading-relaxed">
              {/* Step code box */}
              <div>
                <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block mb-1">Retrieval Payload</span>
                <pre className={`p-4 rounded-xl border overflow-x-auto text-[11px] leading-relaxed max-h-[160px] scrollbar-hide transition-colors ${
                  isLight 
                    ? "bg-zinc-50 border-zinc-200/80 text-zinc-800" 
                    : "bg-zinc-950/80 border-white/[0.05] text-[#a5d6ff]"
                }`}>
                  <code>
                    {activeStep < 4 ? query.steps[activeStep]?.code : query.steps[3]?.code}
                  </code>
                </pre>
              </div>

              {/* Streaming Grounded Output */}
              <div className={`p-4 rounded-xl border transition-colors ${
                isLight 
                  ? "bg-[#2563eb]/[0.02] border-[#2563eb]/10" 
                  : "bg-[#2563eb]/[0.03] border-[#2563eb]/10"
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-[#2563eb] animate-pulse" />
                  <span className="text-[#2563eb] text-[10px] uppercase font-bold tracking-wider">Streaming Grounded Output</span>
                </div>
                
                <p className={`min-h-[60px] text-[12px] leading-relaxed transition-colors ${
                  isLight ? "text-zinc-800" : "text-zinc-200"
                }`}>
                  {streamedAnswer || (
                    <span className="text-zinc-400 dark:text-zinc-600 italic">Waiting for pipeline plan to resolve...</span>
                  )}
                  {isTyping && <span className="inline-block w-1.5 h-3 bg-[#2563eb] animate-pulse ml-0.5" />}
                </p>
              </div>

              {/* Citations panel */}
              {activeStep >= 4 && (
                <div className="space-y-1.5 pt-2 border-t border-dashed border-zinc-200 dark:border-white/[0.05]">
                  <span className="text-zinc-500 text-[9px] uppercase font-bold tracking-wider block">Grounded Citations</span>
                  <div className="flex flex-wrap gap-2">
                    {query.citations.map((cite, idx) => (
                      <span 
                        key={idx}
                        className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border transition-colors ${
                          isLight 
                            ? "bg-zinc-100 border-zinc-200 text-zinc-700" 
                            : "bg-white/[0.03] border-white/[0.08] text-zinc-300"
                        }`}
                      >
                        [{idx + 1}] {cite}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Use cases ────────────────────────────────────────────────────────────────

// ─── Use cases ────────────────────────────────────────────────────────────────

const USE_CASES = [
  {
    icon: <Database size={16} />,
    tag: "Databases",
    headline: "Query MongoDB in plain English",
    outcome: "Introspects schemas and generates aggregations instantly. No complex exports.",
  },
  {
    icon: <FileText size={16} />,
    tag: "Documents",
    headline: "Chat with PDFs and get cited answers",
    outcome: "Every generated answer links back directly to precise document segments.",
  },
  {
    icon: <Globe size={16} />,
    tag: "Intelligence",
    headline: "Synthesized web + document analysis",
    outcome: "Cross-references internal sheets and databases with real-time web results.",
  },
];

// ─── How it works ────────────────────────────────────────────────────────────

const STEPS = [
  { n: "01", icon: <Database size={18} />, title: "Connect source data", desc: "Securely link your MongoDB instance, Sheets, or upload private PDFs in 60s." },
  { n: "02", icon: <Zap size={18} />,      title: "Ask natural questions", desc: "Type naturally in plain English. The orchestration layer parses intents dynamically." },
  { n: "03", icon: <FileText size={18} />, title: "Get verifiable answers", desc: "Responses are mathematically grounded in your data with full citations." },
];

// ─── Tech logos ───────────────────────────────────────────────────────────────

const TECH = [
  { icon: <SiMongodb size={20} />,      label: "MongoDB" },
  { icon: <SiGooglesheets size={20} />, label: "Google Sheets" },
  { icon: <SiPostgresql size={20} />,   label: "PostgreSQL" },
  { icon: (
    <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
      <path d="M24 4L44 40H4L24 4Z" fill="currentColor" fillOpacity="0.8"/>
    </svg>
  ), label: "Gemini AI" },
  { icon: (
    <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
      <rect x="4" y="4" width="18" height="18" rx="3" fill="currentColor" fillOpacity="0.8"/>
      <rect x="26" y="4" width="18" height="18" rx="3" fill="currentColor" fillOpacity="0.5"/>
      <rect x="4" y="26" width="18" height="18" rx="3" fill="currentColor" fillOpacity="0.5"/>
      <rect x="26" y="26" width="18" height="18" rx="3" fill="currentColor" fillOpacity="0.8"/>
    </svg>
  ), label: "Documents" },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0 },
};

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";

  const mainStyle = {
    background: "var(--bg-base)",
    color: "var(--text-primary)",
    backgroundImage: isLight
      ? `
        radial-gradient(circle at 50% -10%, rgba(37, 99, 235, 0.08) 0%, rgba(99, 102, 241, 0.02) 30%, transparent 60%),
        radial-gradient(circle at 0% 100%, rgba(37, 99, 235, 0.01) 0%, transparent 40%),
        radial-gradient(circle at 100% 100%, rgba(99, 102, 241, 0.01) 0%, transparent 40%),
        linear-gradient(rgba(15, 23, 42, 0.035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(15, 23, 42, 0.035) 1px, transparent 1px)
      `
      : `
        radial-gradient(circle at 50% -10%, rgba(37, 99, 235, 0.15) 0%, rgba(99, 102, 241, 0.05) 30%, transparent 60%),
        radial-gradient(circle at 0% 100%, rgba(37, 99, 235, 0.02) 0%, transparent 40%),
        radial-gradient(circle at 100% 100%, rgba(99, 102, 241, 0.02) 0%, transparent 40%),
        linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px)
      `,
    backgroundSize: "100% 100%, 100% 100%, 100% 100%, 56px 56px, 56px 56px"
  };

  return (
    <main 
      className="min-h-screen overflow-x-hidden selection:bg-[#2563eb]/25 transition-colors duration-300"
      style={mainStyle}
    >

      {/* ── Nav — SpotGov Floating Capsule style ───────────────────── */}
      <nav 
        className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex justify-between items-center px-6 h-12 w-[calc(100%-2rem)] max-w-4xl rounded-full transition-all duration-300"
        style={{ 
          background: isLight ? "rgba(255, 255, 255, 0.75)" : "rgba(10, 10, 12, 0.75)", 
          backdropFilter: "blur(20px)", 
          WebkitBackdropFilter: "blur(20px)", 
          border: isLight ? "1px solid rgba(15, 23, 42, 0.08)" : "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: isLight ? "0 10px 30px rgba(0,0,0,0.03), inset 0 1px 1px rgba(255,255,255,0.8)" : "0 12px 40px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.05)"
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[12px] tracking-[0.25em] font-bold uppercase text-[var(--text-primary)] transition-colors duration-300" style={{ fontFamily: "var(--font-display)" }}>WUUP</span>
          <span className="text-[9px] font-semibold text-[#2563eb] bg-[#2563eb]/10 px-2 py-0.5 rounded-full uppercase tracking-wider scale-90">v1.2</span>
        </div>
        <div className="flex items-center gap-5">
          <a href="#how-it-works" className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors tracking-wide hidden sm:block">How it works</a>
          <a href="#byok" className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors tracking-wide hidden sm:block">Pricing</a>
          
          {/* Light/Dark Toggle */}
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-full border transition-all flex items-center justify-center cursor-pointer shadow-sm ${
              isLight 
                ? "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-100" 
                : "border-white/[0.08] bg-zinc-950/20 text-zinc-300 hover:bg-white/[0.04]"
            }`}
            title="Toggle theme"
          >
            {isLight ? <Moon size={14} className="stroke-[2.2]" /> : <Sun size={14} className="stroke-[2.2]" />}
          </button>

          <Link
            href="/login"
            className="text-[11px] font-semibold px-4 py-1.5 rounded-full transition-all tracking-wide bg-[#2563eb] text-white hover:bg-[#1d4ed8] hover:scale-[1.03] active:scale-[0.97]"
            style={{ boxShadow: "0 4px 12px rgba(37,99,235,0.25)" }}
          >
            Start free
          </Link>
        </div>
      </nav>

      {/* ── Hero — High-End Editorial Style ─────────────────────────── */}
      <section className="relative pt-36 pb-20 px-6 sm:px-10 max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row items-start gap-16 lg:gap-20">

          {/* Left — copy */}
          <div className="flex-1 max-w-xl">
            <motion.div
              initial={{ opacity: 0, y: 8 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ duration: 0.5 }}
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] mb-8 tracking-[0.1em] uppercase font-medium transition-colors ${
                isLight ? "border-zinc-200 bg-zinc-100 text-zinc-600" : "border-white/[0.08] bg-zinc-900/40 text-zinc-400"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb] shadow-[0_0_8px_rgba(37,99,235,0.8)] inline-block animate-pulse" />
              50 intelligence queries free · No card required
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 12 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: 0.1, duration: 0.6 }}
              className={`text-[clamp(2.5rem,5.5vw,4.2rem)] font-light leading-[1.05] tracking-tight mb-6 transition-colors ${
                isLight ? "text-zinc-900" : "text-white"
              }`}
              style={{ fontFamily: "var(--font-display)" }}
            >
              Talk to your<br />
              <span className="text-[#2563eb] font-normal">data.</span> Get answers.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 8 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: 0.2, duration: 0.55 }}
              className={`text-[14.5px] leading-relaxed mb-10 max-w-md font-light transition-colors ${
                isLight ? "text-zinc-600" : "text-zinc-300"
              }`}
            >
              Connect MongoDB databases, stream Google Sheets, or upload secure PDFs — then ask anything in plain, conversational English with mathematical grounding.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 8 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: 0.3, duration: 0.5 }}
              className="flex flex-col sm:flex-row gap-3"
            >
              <Link
                href="/login"
                className="group inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full text-white text-[12px] font-semibold tracking-wide transition-all bg-[#2563eb] hover:bg-[#1d4ed8] active:scale-[0.98]"
                style={{ boxShadow: "0 4px 20px rgba(37,99,235,0.3)" }}
              >
                Start for free
                <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <a
                href="https://www.notion.so/Wup-350d9fc386ee80fa8d2dea6736f86625?source=copy_link"
                target="_blank" rel="noopener noreferrer"
                className={`inline-flex items-center justify-center px-6 py-2.5 rounded-full border text-[12px] transition-all tracking-wide ${
                  isLight 
                    ? "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 hover:text-black shadow-sm" 
                    : "border-white/[0.08] bg-zinc-950/20 text-zinc-300 hover:text-white hover:bg-zinc-900/40"
                }`}
              >
                Read documentation
              </a>
            </motion.div>

            {/* Trust signals */}
            <motion.div
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              transition={{ delay: 0.45, duration: 0.5 }}
              className="flex items-center gap-5 mt-9"
            >
              {["No SQL required", "Read-only isolated", "BYOK fallback"].map(t => (
                <div key={t} className="flex items-center gap-1.5">
                  <Check size={11} className="text-emerald-500" />
                  <span className={`text-[11px] tracking-wide transition-colors ${
                    isLight ? "text-zinc-500" : "text-zinc-400"
                  }`}>{t}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right — terminal demo */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.2, duration: 0.7 }}
            className="flex-1 w-full max-w-lg lg:max-w-none"
          >
            <TerminalDemo />
          </motion.div>
        </div>
      </section>

      {/* ── Built with ── */}
      <section className={`py-10 border-y transition-colors duration-300 ${isLight ? "border-zinc-200/80 bg-zinc-100/40" : "border-white/[0.06] bg-white/[0.01]"}`}>
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center gap-6 sm:gap-12">
          <p className={`text-[9px] uppercase tracking-[0.35em] whitespace-nowrap font-bold shrink-0 transition-colors ${isLight ? "text-zinc-500" : "text-zinc-500"}`}>Integration Layer</p>
          <div className={`w-px h-5 hidden sm:block shrink-0 ${isLight ? "bg-zinc-200" : "bg-white/[0.08]"}`} />
          <div className="flex items-center gap-10 flex-wrap justify-center sm:justify-start">
            {TECH.map(t => (
              <div key={t.label} className={`flex items-center gap-2.5 transition-colors cursor-default select-none ${isLight ? "text-zinc-600 hover:text-zinc-900" : "text-zinc-400 hover:text-zinc-200"}`}>
                <span className="opacity-70 text-[#2563eb]">{t.icon}</span>
                <span className="text-[11.5px] tracking-wide font-medium">{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3 Use Cases ─────────────────────────────────────────────── */}
      <section className="py-24 px-6 sm:px-10">
        <div className="max-w-5xl mx-auto">
          <motion.div
            variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} transition={{ duration: 0.5 }}
            className="mb-14 flex flex-col sm:flex-row sm:items-end justify-between gap-4"
          >
            <div>
              <p className="text-[9px] uppercase tracking-[0.4em] text-zinc-500 mb-2.5 flex items-center gap-2 font-bold">
                <span className="w-1 h-1 rounded-full bg-[#2563eb] inline-block" />
                Core capabilities
              </p>
              <h2 className={`text-[clamp(1.7rem,3vw,2.3rem)] tracking-tight leading-tight transition-colors ${
                isLight ? "text-zinc-900" : "text-white"
              }`} style={{ fontFamily: "var(--font-display)" }}>
                Engineered for structured<br />and unstructured intelligence.
              </h2>
            </div>
            <Link href="/login" className="text-[11.5px] text-[#2563eb] hover:text-[#1d4ed8] transition-colors flex items-center gap-1.5 shrink-0 font-medium">
              Explore live workspace <ArrowRight size={11} />
            </Link>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {USE_CASES.map((uc, i) => (
              <motion.div
                key={uc.tag}
                variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.5 }}
                className={`group p-7 rounded-2xl flex flex-col gap-5 cursor-default transition-all duration-300 border ${
                  isLight 
                    ? "bg-white border-zinc-200/80 shadow-sm" 
                    : "bg-white/[0.015] border-white/[0.05] shadow-none"
                }`}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = "rgba(37, 99, 235, 0.35)";
                  e.currentTarget.style.background = isLight ? "rgba(37, 99, 235, 0.02)" : "rgba(37, 99, 235, 0.02)";
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = isLight 
                    ? "0 12px 30px -10px rgba(37,99,235,0.08), 0 0 0 1px rgba(37,99,235,0.1)" 
                    : "0 12px 30px -10px rgba(0,0,0,0.6), 0 0 0 1px rgba(37,99,235,0.1)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = isLight ? "rgba(228, 228, 231, 0.8)" : "rgba(255,255,255,0.05)";
                  e.currentTarget.style.background = isLight ? "#ffffff" : "rgba(255,255,255,0.015)";
                  e.currentTarget.style.transform = "translateY(0px)";
                  e.currentTarget.style.boxShadow = isLight ? "0 1px 2px rgba(0,0,0,0.02)" : "none";
                }}
              >
                <div 
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-[#2563eb]"
                  style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.18)" }}
                >
                  {uc.icon}
                </div>
                <div>
                  <span className="text-[8.5px] font-bold uppercase tracking-[0.2em] text-[#2563eb] block mb-1.5">{uc.tag}</span>
                  <h3 className={`text-[14.5px] font-medium leading-snug transition-colors ${isLight ? "text-zinc-900" : "text-zinc-100"}`}>{uc.headline}</h3>
                </div>
                <p className={`text-[12px] leading-relaxed mt-auto border-t pt-4 transition-colors ${isLight ? "border-zinc-100 text-zinc-600" : "border-white/[0.04] text-zinc-400"}`}>{uc.outcome}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Visual Architecture ──────────────────────────────────────── */}
      <section id="how-it-works" className={`py-20 px-6 sm:px-10 border-t transition-colors duration-300 ${isLight ? "border-zinc-200/80 bg-zinc-100/10" : "border-white/[0.05] bg-white/[0.003]"}`}>
        <div className="max-w-5xl mx-auto">
          <motion.div
            variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} transition={{ duration: 0.5 }}
            className="mb-12 text-center"
          >
            <p className="text-[9px] uppercase tracking-[0.4em] text-zinc-500 mb-2.5 flex items-center justify-center gap-2 font-bold">
              <span className="w-1 h-1 rounded-full bg-[#2563eb] inline-block animate-pulse" />
              Agent Sandbox
            </p>
            <h2 className={`text-[clamp(1.7rem,3vw,2.3rem)] tracking-tight transition-colors ${
              isLight ? "text-zinc-900" : "text-white"
            }`} style={{ fontFamily: "var(--font-display)" }}>
              Interactive Execution Playground.
            </h2>
            <p className={`text-[12.5px] mt-2 max-w-lg mx-auto transition-colors ${isLight ? "text-zinc-600" : "text-zinc-400"}`}>
              Select a complex multi-source query and watch our autonomous reasoning engine plan, retrieve, and synthesize mathematically grounded answers.
            </p>
          </motion.div>

          <motion.div
            variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} transition={{ delay: 0.1, duration: 0.5 }}
          >
            <AgenticExecutionSandbox />
          </motion.div>
        </div>
      </section>

      {/* ── BYOK ────────────────────────────────────────────────────── */}
      <section id="byok" className={`py-24 px-6 sm:px-10 border-t transition-colors duration-300 ${isLight ? "border-zinc-200/80" : "border-white/[0.05]"}`}>
        <div className="max-w-5xl mx-auto">
          <motion.div
            variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} transition={{ duration: 0.5 }}
          >
            {/* Outer card */}
            <div className={`rounded-2xl overflow-hidden border transition-all duration-300 ${
              isLight ? "border-zinc-200/80 bg-white shadow-sm" : "border-white/[0.07] bg-white/[0.01]"
            }`}>
              <div className="flex flex-col md:flex-row">

                {/* Left — copy */}
                <div className="flex-1 p-10 flex flex-col gap-6" style={{ background: "rgba(255,255,255,0.005)" }}>
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-[#2563eb]"
                      style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.18)" }}
                    >
                      <Key size={16} />
                    </div>
                    <span className="text-[8.5px] font-bold uppercase tracking-[0.25em] text-[#2563eb]">Control Quotas</span>
                  </div>
                  <div>
                    <h2 className={`text-[clamp(1.5rem,2.5vw,2rem)] font-semibold leading-tight mb-3 transition-colors ${isLight ? "text-zinc-900" : "text-white"}`} style={{ fontFamily: "var(--font-display)" }}>
                      Bring Your Own Key.<br />Direct API cost.
                    </h2>
                    <p className={`text-[12.5px] leading-relaxed max-w-sm transition-colors ${isLight ? "text-zinc-600" : "text-zinc-400"}`}>
                      Securely paste your Gemini or OpenRouter API key. Wuup bypasses SaaS markups, calling Google and Anthropic endpoints directly.
                    </p>
                  </div>
                  <Link href="/login" className="self-start inline-flex items-center gap-2 text-[11.5px] font-medium tracking-wide text-[#2563eb] hover:text-[#1d4ed8]">
                    Configure key in settings <ArrowRight size={11} />
                  </Link>
                </div>

                {/* Right — Visual Mock Settings Panel */}
                <div className={`flex-1 p-8 flex flex-col justify-center border-l transition-all duration-300 ${
                  isLight ? "bg-zinc-50/40 border-zinc-200/80" : "bg-white/[0.005] border-white/[0.06]"
                }`}>
                  <div className={`p-5 rounded-2xl border transition-all duration-300 ${
                    isLight ? "bg-white border-zinc-200 shadow-[0_8px_30px_rgba(20,24,38,0.02)]" : "bg-zinc-950/40 border-white/[0.05]"
                  }`}>
                    <div className={`flex items-center justify-between mb-4 border-b pb-3 transition-colors ${
                      isLight ? "border-zinc-200/80" : "border-white/[0.04]"
                    }`}>
                      <span className={`text-[11px] font-bold tracking-wide transition-colors ${
                        isLight ? "text-zinc-900" : "text-white"
                      }`}>Developer API Keys</span>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full text-emerald-600 dark:text-emerald-500 bg-emerald-500/10 uppercase tracking-wider">Active</span>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">OpenRouter API Key</label>
                          <span className="text-[9px] text-[#2563eb] font-bold">85% cheaper direct pricing</span>
                        </div>
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-mono transition-colors ${
                          isLight 
                            ? "bg-zinc-50 border-zinc-200 text-zinc-700 font-medium" 
                            : "bg-zinc-900/60 border-white/[0.05] text-zinc-400"
                        }`}>
                          <span>sk-or-v1-••••••••••••••••••••••••••••••••</span>
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Gemini API Key</label>
                          <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-semibold">Direct fallback enabled</span>
                        </div>
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-mono transition-colors ${
                          isLight 
                            ? "bg-zinc-50 border-zinc-200 text-zinc-700 font-medium" 
                            : "bg-zinc-900/60 border-white/[0.05] text-zinc-400"
                        }`}>
                          <span>AIzaSy••••••••••••••••••••••••••••••••</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <section className={`py-28 px-6 text-center border-t transition-colors duration-300 ${isLight ? "border-zinc-200/80 bg-zinc-50/20" : "border-white/[0.05] bg-white/[0.005]"}`}>
        {/* Glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[500px] h-[180px] rounded-full"
            style={{ background: isLight ? "radial-gradient(ellipse, rgba(37, 99, 235, 0.03) 0%, transparent 70%)" : "radial-gradient(ellipse, rgba(37, 99, 235, 0.05) 0%, transparent 70%)" }} />
        </div>
        <motion.div
          variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} transition={{ duration: 0.5 }}
          className="relative"
        >
          <p className="text-[9px] uppercase tracking-[0.4em] text-zinc-500 mb-5 font-bold">Workspace access</p>
          <h2 className={`text-[clamp(1.8rem,4vw,3rem)] tracking-tight mb-4 leading-tight transition-colors ${
            isLight ? "text-zinc-900" : "text-white"
          }`} style={{ fontFamily: "var(--font-display)" }}>
            Unlock your database context.
          </h2>
          <p className={`text-[13.5px] mb-8 tracking-wide font-light transition-colors ${
            isLight ? "text-zinc-600" : "text-zinc-400"
          }`}>
            Start completely free with 50 rotatable API calls.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full text-white text-[12px] font-semibold tracking-wide active:scale-[0.97] transition-all bg-[#2563eb] hover:bg-[#1d4ed8]"
            style={{ boxShadow: "0 4px 20px rgba(37,99,235,0.25)" }}
          >
            Launch workspace
            <ArrowRight size={12} />
          </Link>
        </motion.div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className={`border-t transition-colors duration-300 py-12 px-6 sm:px-10 ${isLight ? "border-zinc-200/80 bg-white" : "border-white/[0.05] bg-black/20"}`}>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div>
            <span className={`text-[12px] tracking-[0.2em] font-bold uppercase block mb-1.5 transition-colors ${
              isLight ? "text-zinc-900" : "text-white"
            }`} style={{ fontFamily: "var(--font-display)" }}>WUUP</span>
            <p className={`text-[11px] font-light transition-colors ${isLight ? "text-zinc-500" : "text-zinc-500"}`}>High-performance intelligence orchestration platform.</p>
          </div>
          <div className={`flex gap-8 text-[11.5px] transition-colors ${isLight ? "text-zinc-500" : "text-zinc-500"}`}>
            <a href="https://www.notion.so/Wup-350d9fc386ee80fa8d2dea6736f86625?source=copy_link" target="_blank" rel="noopener noreferrer" className="hover:text-[#2563eb] transition-colors">Docs</a>
            <Link href="/login" className="hover:text-[#2563eb] transition-colors">Login</Link>
            <span className={`transition-colors ${isLight ? "text-zinc-400" : "text-zinc-600"}`}>© 2026 Wuup</span>
          </div>
        </div>
      </footer>

    </main>
  );
}
