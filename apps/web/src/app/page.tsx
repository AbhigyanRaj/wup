"use client";

import Link from "next/link";
import { ArrowRight, Database, FileText, Globe, Zap, Key, Check } from "lucide-react";
import { SiMongodb, SiGooglesheets, SiPostgresql } from "react-icons/si";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";

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
  const [visibleLines, setVisibleLines] = useState<number[]>([]);

  useEffect(() => {
    DEMO_LINES.forEach((line, i) => {
      setTimeout(() => {
        setVisibleLines(prev => [...prev, i]);
      }, line.delay);
    });
  }, []);

  return (
    <div
      className="w-full rounded-2xl overflow-hidden shadow-2xl"
      style={{
        background: "#0a0a0a",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 40px 80px -20px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)",
      }}
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]" style={{ background: "rgba(255,255,255,0.02)" }}>
        <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
        <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
        <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
        <span className="ml-3 text-[11px] font-mono opacity-30 tracking-wider">wuup — chat</span>
      </div>

      {/* Content */}
      <div className="p-6 space-y-3 min-h-[280px] font-mono text-[12.5px]">
        {DEMO_LINES.map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={visibleLines.includes(i) ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.3 }}
          >
            {line.type === "prompt" && (
              <div className="flex items-start gap-2">
                <span style={{ color: "var(--orange)" }}>›</span>
                <span className="text-white/80">{line.text}</span>
              </div>
            )}
            {line.type === "status" && (
              <div className="flex items-center gap-2 opacity-40">
                <div className="w-1 h-1 rounded-full bg-[var(--orange)] animate-pulse" />
                <span style={{ color: "var(--text-secondary)" }}>{line.text}</span>
              </div>
            )}
            {line.type === "result" && (
              <div className="opacity-50" style={{ color: "var(--green)" }}>✓ {line.text}</div>
            )}
            {line.type === "answer" && (
              <div className="text-white/75 pt-1">{line.text}</div>
            )}
            {line.type === "table" && (
              <div className="mt-2 rounded-xl overflow-hidden border border-white/[0.07]">
                <table className="w-full text-left">
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                      {["Customer", "Revenue", "vs Last Month"].map(h => (
                        <th key={h} className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest opacity-30">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TABLE_ROWS.map(([name, rev, change], ri) => (
                      <tr key={ri} className="border-t border-white/[0.04]">
                        <td className="px-4 py-2 text-white/70">{name}</td>
                        <td className="px-4 py-2 font-bold" style={{ color: "var(--orange)" }}>{rev}</td>
                        <td className="px-4 py-2" style={{ color: change.includes("↑") ? "var(--green)" : "var(--red)" }}>{change}</td>
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
            className="w-2 h-4 rounded-sm mt-1"
            style={{ background: "var(--orange)" }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Use cases ────────────────────────────────────────────────────────────────

const USE_CASES = [
  {
    icon: <Database size={18} />,
    tag: "Databases",
    headline: "Query your MongoDB in plain English",
    outcome: "Get answers in seconds. No SQL, no aggregations, no exports.",
  },
  {
    icon: <FileText size={18} />,
    tag: "Documents",
    headline: "Chat with your PDFs and get cited answers",
    outcome: "Every response links back to the exact page it came from.",
  },
  {
    icon: <Globe size={18} />,
    tag: "Research",
    headline: "Your data + the web, combined",
    outcome: "Ground AI answers in your internal data and live web results together.",
  },
];

// ─── How it works ────────────────────────────────────────────────────────────

const STEPS = [
  { n: "01", icon: <Database size={20} />, title: "Connect your data", desc: "Link a MongoDB database, upload PDFs, or connect Google Sheets in under 60 seconds." },
  { n: "02", icon: <Zap size={20} />,      title: "Ask in plain English", desc: "Type your question naturally. No query language needed, ever." },
  { n: "03", icon: <FileText size={20} />, title: "Get grounded answers", desc: "Wuup cites its sources. Every fact traces back to your data." },
];

// ─── Tech logos ───────────────────────────────────────────────────────────────

const TECH = [
  { icon: <SiMongodb size={22} />,      label: "MongoDB" },
  { icon: <SiGooglesheets size={22} />, label: "Google Sheets" },
  { icon: <SiPostgresql size={22} />,   label: "PostgreSQL" },
  { icon: (
    <svg width="22" height="22" viewBox="0 0 48 48" fill="none">
      <path d="M24 4L44 40H4L24 4Z" fill="currentColor" fillOpacity="0.8"/>
    </svg>
  ), label: "Gemini AI" },
  { icon: (
    <svg width="22" height="22" viewBox="0 0 48 48" fill="none">
      <rect x="4" y="4" width="18" height="18" rx="3" fill="currentColor" fillOpacity="0.8"/>
      <rect x="26" y="4" width="18" height="18" rx="3" fill="currentColor" fillOpacity="0.5"/>
      <rect x="4" y="26" width="18" height="18" rx="3" fill="currentColor" fillOpacity="0.5"/>
      <rect x="26" y="26" width="18" height="18" rx="3" fill="currentColor" fillOpacity="0.8"/>
    </svg>
  ), label: "PDFs & Docs" },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0 },
};

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white overflow-x-hidden selection:bg-white/10">

      {/* ── Nav ────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-6 sm:px-10 h-14"
        style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span className="text-[14px] tracking-[0.2em] font-bold uppercase text-white/85" style={{ fontFamily: "var(--font-display)" }}>WUUP</span>
        <div className="flex items-center gap-6">
          <a href="#how-it-works" className="text-[12px] text-white/35 hover:text-white/70 transition-colors tracking-wide hidden sm:block">How it works</a>
          <a href="#byok" className="text-[12px] text-white/35 hover:text-white/70 transition-colors tracking-wide hidden sm:block">Pricing</a>
          <Link
            href="/login"
            className="text-[12px] font-semibold px-4 py-1.5 rounded-full transition-all tracking-wide"
            style={{ background: "var(--orange)", color: "#000", boxShadow: "0 0 16px rgba(255,95,31,0.3)" }}
          >
            Start free
          </Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 px-6 sm:px-10 max-w-6xl mx-auto">

        {/* Glow */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(255,95,31,0.06) 0%, transparent 70%)" }} />

        <div className="flex flex-col lg:flex-row items-start gap-16 lg:gap-20">

          {/* Left — copy */}
          <div className="flex-1 max-w-xl">
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/[0.08] bg-white/[0.03] text-[10.5px] text-white/35 mb-8 tracking-[0.12em] uppercase"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--orange)] shadow-[0_0_8px_rgba(255,95,31,0.6)] inline-block" />
              50 queries free · No card required
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.6 }}
              className="text-[clamp(2.2rem,5vw,3.8rem)] leading-[1.05] tracking-tight text-white/92 mb-6"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Talk to your<br />
              <span style={{ color: "var(--orange)" }}>data.</span> Get answers.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.55 }}
              className="text-[15px] leading-relaxed text-white/38 mb-10 max-w-md font-light"
            >
              Connect MongoDB, upload documents, search the web — then ask anything in plain English. Wuup cites every answer.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }}
              className="flex flex-col sm:flex-row gap-3"
            >
              <Link
                href="/login"
                className="group inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-black text-[13px] font-bold tracking-wide transition-all active:scale-[0.97]"
                style={{ background: "var(--orange)", boxShadow: "0 0 24px rgba(255,95,31,0.25)" }}
              >
                Start for free
                <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <a
                href="https://www.notion.so/Wuup-350d9fc386ee80fa8d2dea6736f86625"
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-6 py-3 rounded-full border border-white/[0.09] bg-white/[0.03] text-[13px] text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all tracking-wide"
              >
                Read docs
              </a>
            </motion.div>

            {/* Trust signals */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.5 }}
              className="flex items-center gap-5 mt-8"
            >
              {["No SQL needed", "Read-only safe", "Your API key"].map(t => (
                <div key={t} className="flex items-center gap-1.5">
                  <Check size={11} style={{ color: "var(--green)" }} />
                  <span className="text-[11px] text-white/28 tracking-wide">{t}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right — terminal demo */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.7 }}
            className="flex-1 w-full max-w-lg lg:max-w-none"
          >
            <TerminalDemo />
          </motion.div>
        </div>
      </section>

      {/* ── Built with ──────────────────────────────────────────────── */}
      <section className="py-12 border-y border-white/[0.07]" style={{ background: "rgba(255,255,255,0.025)" }}>
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center gap-6 sm:gap-12">
          <p className="text-[10px] uppercase tracking-[0.35em] text-white/30 whitespace-nowrap font-semibold shrink-0">Built with</p>
          <div className="w-px h-6 bg-white/[0.08] hidden sm:block shrink-0" />
          <div className="flex items-center gap-10 flex-wrap justify-center sm:justify-start">
            {TECH.map(t => (
              <div key={t.label} className="flex items-center gap-2.5 text-white/35 hover:text-white/65 transition-colors cursor-default">
                {t.icon}
                <span className="text-[12px] tracking-wide font-medium">{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3 Use Cases ─────────────────────────────────────────────── */}
      <section className="py-28 px-6 sm:px-10">
        <div className="max-w-5xl mx-auto">
          <motion.div
            variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} transition={{ duration: 0.5 }}
            className="mb-16 flex flex-col sm:flex-row sm:items-end justify-between gap-4"
          >
            <div>
              <p className="text-[9px] uppercase tracking-[0.45em] text-white/30 mb-3 flex items-center gap-2 font-semibold">
                <span className="w-1 h-1 rounded-full bg-[var(--orange)] inline-block" />
                What you can do
              </p>
              <h2 className="text-[clamp(1.7rem,3.5vw,2.5rem)] tracking-tight text-white/92 leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                See yourself<br />in the use case.
              </h2>
            </div>
            <Link href="/login" className="text-[12px] text-white/30 hover:text-white/60 transition-colors flex items-center gap-1.5 shrink-0">
              Try all of these free <ArrowRight size={11} />
            </Link>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {USE_CASES.map((uc, i) => (
              <motion.div
                key={uc.tag}
                variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5 }}
                className="group p-7 rounded-2xl flex flex-col gap-5 cursor-default transition-all duration-250"
                style={{
                  background: i === 1 ? "rgba(255,255,255,0.045)" : "rgba(255,255,255,0.03)",
                  border: i === 1 ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(255,255,255,0.07)",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,95,31,0.25)";
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,95,31,0.04)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = i === 1 ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.07)";
                  (e.currentTarget as HTMLElement).style.background = i === 1 ? "rgba(255,255,255,0.045)" : "rgba(255,255,255,0.03)";
                }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--orange)]"
                  style={{ background: "rgba(255,95,31,0.1)", border: "1px solid rgba(255,95,31,0.18)" }}>
                  {uc.icon}
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-white/30 block mb-2">{uc.tag}</span>
                  <h3 className="text-[15px] font-medium text-white/85 leading-snug">{uc.headline}</h3>
                </div>
                <p className="text-[12.5px] text-white/38 leading-relaxed mt-auto border-t border-white/[0.05] pt-4">{uc.outcome}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-28 px-6 sm:px-10 border-t border-white/[0.07]"
        style={{ background: "rgba(255,255,255,0.018)" }}>
        <div className="max-w-5xl mx-auto">
          <motion.div
            variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} transition={{ duration: 0.5 }}
            className="mb-16"
          >
            <p className="text-[9px] uppercase tracking-[0.45em] text-white/30 mb-3 flex items-center gap-2 font-semibold">
              <span className="w-1 h-1 rounded-full bg-[var(--orange)] inline-block" />
              How it works
            </p>
            <h2 className="text-[clamp(1.7rem,3.5vw,2.5rem)] tracking-tight text-white/92" style={{ fontFamily: "var(--font-display)" }}>
              Three steps. That's it.
            </h2>
          </motion.div>

          <div className="flex flex-col md:flex-row gap-0 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-10 left-[16.6%] right-[16.6%] h-px"
              style={{ background: "linear-gradient(to right, transparent, rgba(255,95,31,0.2), transparent)" }} />

            {STEPS.map((step, i) => (
              <motion.div
                key={step.n}
                variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} transition={{ delay: i * 0.13, duration: 0.5 }}
                className="flex-1 px-8 py-8 flex flex-col gap-5"
                style={{
                  borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none"
                }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--orange)] shrink-0 relative z-10"
                    style={{ background: "rgba(255,95,31,0.1)", border: "1px solid rgba(255,95,31,0.22)" }}>
                    {step.icon}
                  </div>
                  <span className="text-[11px] font-mono font-bold tracking-widest text-white/20">{step.n}</span>
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-white/85 mb-2">{step.title}</h3>
                  <p className="text-[13px] text-white/38 leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BYOK ────────────────────────────────────────────────────── */}
      <section id="byok" className="py-28 px-6 sm:px-10 border-t border-white/[0.07]">
        <div className="max-w-5xl mx-auto">
          <motion.div
            variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} transition={{ duration: 0.5 }}
          >
            {/* Outer card */}
            <div className="rounded-3xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.09)" }}>
              <div className="flex flex-col md:flex-row">

                {/* Left — copy */}
                <div className="flex-1 p-10 flex flex-col gap-6" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--orange)]"
                      style={{ background: "rgba(255,95,31,0.1)", border: "1px solid rgba(255,95,31,0.2)" }}>
                      <Key size={18} />
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-[0.35em] text-white/30">Bring Your Own Key</span>
                  </div>
                  <div>
                    <h2 className="text-[clamp(1.5rem,2.5vw,2.1rem)] font-semibold text-white/90 leading-tight mb-3" style={{ fontFamily: "var(--font-display)" }}>
                      Your key.<br />Your cost.<br />Full control.
                    </h2>
                    <p className="text-[13px] text-white/40 leading-relaxed max-w-xs">
                      Paste your Gemini API key. Wuup calls Google directly — no markup, no middleman. You pay Google's published rates and nothing more.
                    </p>
                  </div>
                  <Link href="/login" className="self-start inline-flex items-center gap-2 text-[12px] font-semibold tracking-wide"
                    style={{ color: "var(--orange)" }}>
                    Add your key after signup <ArrowRight size={11} />
                  </Link>
                </div>

                {/* Right — comparison */}
                <div className="flex-1 flex flex-col" style={{ background: "rgba(255,255,255,0.018)", borderLeft: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="grid grid-cols-3 px-8 py-5 border-b border-white/[0.06]">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/20"></span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Free</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--orange)" }}>Your key</span>
                  </div>
                  {[
                    ["Queries", "50 total", "Unlimited"],
                    ["Cost", "Included", "Your rates"],
                    ["Models", "Rotated", "All Gemini"],
                    ["Priority", "Shared", "Direct API"],
                  ].map(([label, free, byok], ri) => (
                    <div key={label} className="grid grid-cols-3 px-8 py-4 items-center"
                      style={{ borderBottom: ri < 3 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                      <span className="text-[12px] text-white/40 font-medium">{label}</span>
                      <span className="text-[12px] text-white/30">{free}</span>
                      <span className="text-[12px] font-semibold" style={{ color: "var(--orange)" }}>{byok}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <section className="py-32 px-6 text-center border-t border-white/[0.07] relative overflow-hidden"
        style={{ background: "rgba(255,255,255,0.018)" }}>
        {/* Glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[500px] h-[200px] rounded-full"
            style={{ background: "radial-gradient(ellipse, rgba(255,95,31,0.07) 0%, transparent 70%)" }} />
        </div>
        <motion.div
          variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} transition={{ duration: 0.55 }}
          className="relative"
        >
          <p className="text-[9px] uppercase tracking-[0.45em] text-white/25 mb-6 font-semibold">Get started</p>
          <h2 className="text-[clamp(2rem,5vw,3.5rem)] tracking-tight text-white/92 mb-4 leading-tight" style={{ fontFamily: "var(--font-display)" }}>
            Start for free.
          </h2>
          <p className="text-[14px] text-white/32 mb-10 tracking-wide font-light">
            50 queries included. No card required.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-9 py-4 rounded-full text-black text-[13px] font-bold tracking-wide active:scale-[0.97] transition-all"
            style={{ background: "var(--orange)", boxShadow: "0 0 40px rgba(255,95,31,0.28)" }}
          >
            Get started — it's free
            <ArrowRight size={13} />
          </Link>
        </motion.div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.07] py-10 px-6 sm:px-10">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div>
            <span className="text-[13px] tracking-widest font-bold uppercase text-white/55 block mb-1" style={{ fontFamily: "var(--font-display)" }}>WUUP</span>
            <p className="text-[11px] text-white/22 font-light">AI intelligence for your databases.</p>
          </div>
          <div className="flex gap-8 text-[12px] text-white/28">
            <a href="https://www.notion.so/Wuup-350d9fc386ee80fa8d2dea6736f86625" target="_blank" rel="noopener noreferrer" className="hover:text-white/60 transition-colors">Docs</a>
            <Link href="/login" className="hover:text-white/60 transition-colors">Login</Link>
            <span className="opacity-50">© 2026 Wuup</span>
          </div>
        </div>
      </footer>

    </main>
  );
}
