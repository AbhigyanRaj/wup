"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Key, Zap, BarChart3, CheckCircle } from "lucide-react";

interface DashboardHeroProps {
  userName: string;
  usage?: { freeTierUsage: number; freeTierLimit: number; hasCustomKey: boolean } | null;
}

export function DashboardHero({ userName, usage }: DashboardHeroProps) {
  const [greeting, setGreeting] = useState("Good afternoon");

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 5)       setGreeting("Rest well");
    else if (h < 12) setGreeting("Good morning");
    else if (h < 17) setGreeting("Good afternoon");
    else             setGreeting("Good evening");
  }, []);

  const displayName = userName.charAt(0).toUpperCase() + userName.slice(1);
  const pct = usage && !usage.hasCustomKey
    ? Math.min((usage.freeTierUsage / usage.freeTierLimit) * 100, 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center text-center mb-10 pt-4 w-full"
    >
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.05, duration: 0.4 }}
        className="mb-4 px-3 py-1 rounded-full border border-white/[0.06] bg-white/[0.03] text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 flex items-center gap-2"
      >
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--orange)] shadow-[0_0_6px_rgba(255,95,31,0.5)]" />
        Intelligence Engine
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="text-[34px] sm:text-[40px] tracking-[-0.02em] font-medium text-white/90 leading-tight mb-2.5"
      >
        {greeting},{" "}
        <span className="gradient-text font-bold" style={{ fontFamily: "var(--font-display)" }}>
          {displayName}
        </span>
        .
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="text-[14.5px] font-light tracking-wide max-w-[300px] leading-relaxed mb-8"
        style={{ color: "rgba(255,255,255,0.35)" }}
      >
        Ready to explore your data. What would you like to know?
      </motion.p>

      {/* ── API Key Stats (shown only when key is set) ─────────────── */}
      {usage?.hasCustomKey && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="flex items-center gap-3 mb-2"
        >
          {/* Key indicator */}
          <div
            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl text-[11.5px] font-medium"
            style={{
              background: "rgba(255,95,31,0.07)",
              border: "1px solid rgba(255,95,31,0.18)",
              color: "var(--orange)",
            }}
          >
            <Key size={12} />
            <span className="tracking-wide">Custom API active</span>
          </div>

          {/* Unlimited badge */}
          <div
            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl text-[11.5px] font-medium"
            style={{
              background: "rgba(74,222,128,0.06)",
              border: "1px solid rgba(74,222,128,0.15)",
              color: "var(--green)",
            }}
          >
            <CheckCircle size={12} />
            <span className="tracking-wide">Unlimited queries</span>
          </div>

          {/* Model access */}
          <div
            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl text-[11.5px] font-medium"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            <Zap size={12} />
            <span className="tracking-wide">All Gemini models</span>
          </div>
        </motion.div>
      )}

      {/* ── Free tier usage bar (shown only when no key) ─────────── */}
      {usage && !usage.hasCustomKey && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="flex items-center gap-3 px-4 py-2.5 rounded-2xl mb-2"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <BarChart3 size={12} style={{ color: "rgba(255,255,255,0.3)" }} />
          <span className="text-[11px] text-white/30 tracking-wide font-medium">Free tier</span>
          {/* Progress bar */}
          <div className="w-24 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: pct >= 90 ? "var(--red)" : "var(--orange)",
                boxShadow: pct < 90 ? "0 0 6px rgba(255,95,31,0.4)" : "none",
              }}
            />
          </div>
          <span className="text-[11px] font-mono tabular-nums" style={{ color: pct >= 90 ? "var(--red)" : "rgba(255,255,255,0.35)" }}>
            {usage.freeTierUsage}/{usage.freeTierLimit}
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}
