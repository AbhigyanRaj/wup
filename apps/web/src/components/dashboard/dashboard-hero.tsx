"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Key, Zap, BarChart3, CheckCircle } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

interface DashboardHeroProps {
  userName: string;
  usage?: { freeTierUsage: number; freeTierLimit: number; hasCustomKey: boolean } | null;
}

export function DashboardHero({ userName, usage }: DashboardHeroProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const [tagline, setTagline] = useState("Let's query some data");
  const [subtitle, setSubtitle] = useState("Bridge your PostgreSQL, MongoDB, or upload documents to chat in plain English.");

  useEffect(() => {
    const sentences = [
      {
        tag: "Let's query some data",
        sub: "Bridge your PostgreSQL, MongoDB, or upload files to chat with your databases in plain English."
      },
      {
        tag: "What secrets shall we uncover",
        sub: "Run raw SQL queries, explore collections, or synthesize deep reports from your documents."
      },
      {
        tag: "Ready for database magic",
        sub: "Connect a database source to map relationships and generate visualizations in seconds."
      },
      {
        tag: "Data intelligence awaits",
        sub: "Analyze transactions, query schemas, or generate clean charts automatically."
      }
    ];
    const index = Math.floor(Math.random() * sentences.length);
    setTagline(sentences[index].tag);
    setSubtitle(sentences[index].sub);
  }, []);

  const displayName = userName === "google-demo"
    ? "Explorer"
    : userName.charAt(0).toUpperCase() + userName.slice(1);
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
        className="mb-4 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2"
        style={{
          borderColor: "var(--border)",
          background: "var(--bg-highlight)",
          color: "var(--text-muted)",
        }}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--orange)] shadow-[0_0_6px_rgba(37,99,235,0.45)]" />
        Intelligence Engine
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="text-[32px] sm:text-[38px] tracking-[-0.02em] font-medium leading-tight mb-2.5 transition-colors text-[var(--text-primary)]"
      >
        {tagline},{" "}
        <span className="gradient-text font-bold" style={{ fontFamily: "var(--font-display)" }}>
          {displayName}
        </span>
        .
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="text-[14px] font-light tracking-wide max-w-[460px] leading-relaxed mb-8 transition-colors text-[var(--text-secondary)]"
      >
        {subtitle}
      </motion.p>

      {/* ── API Key Stats (shown only when key is set) ─────────────── */}
      {usage?.hasCustomKey && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="flex flex-wrap items-center justify-center gap-2.5 mb-2"
        >
          {/* Key indicator */}
          <div
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-medium border transition-colors"
            style={{
              background: "var(--bg-highlight)",
              borderColor: "var(--border)",
              color: "var(--text-secondary)",
            }}
          >
            <Key size={11} className="text-[var(--orange)] opacity-85" />
            <span className="tracking-wide">Custom API Active</span>
          </div>

          {/* Unlimited badge */}
          <div
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-medium border transition-colors"
            style={{
              background: "var(--bg-highlight)",
              borderColor: "var(--border)",
              color: "var(--text-secondary)",
            }}
          >
            <CheckCircle size={11} className="text-emerald-500 opacity-85" />
            <span className="tracking-wide">Unlimited Queries</span>
          </div>

          {/* Model access */}
          <div
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-medium border transition-colors"
            style={{
              background: "var(--bg-highlight)",
              borderColor: "var(--border)",
              color: "var(--text-secondary)"
            }}
          >
            <Zap size={11} className="text-[var(--orange)] opacity-85" />
            <span className="tracking-wide">Gemini 2.5 Flash</span>
          </div>
        </motion.div>
      )}

      {/* ── Free tier usage bar (shown only when no key) ─────────── */}
      {usage && !usage.hasCustomKey && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="flex items-center gap-3 px-4 py-2.5 rounded-2xl mb-2 border transition-colors"
          style={{
            background: "var(--bg-raised)",
            borderColor: "var(--border)",
          }}
        >
          <BarChart3 size={12} className="text-[var(--text-muted)]" />
          <span className="text-[11px] tracking-wide font-medium text-[var(--text-muted)]">Free tier</span>
          {/* Progress bar */}
          <div
            className="w-24 h-1 rounded-full overflow-hidden"
            style={{ background: "var(--bg-highlight)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: pct >= 90 ? "var(--red)" : "var(--orange)",
                boxShadow: pct < 90 ? "0 0 6px rgba(37,99,235,0.4)" : "none",
              }}
            />
          </div>
          <span className={`text-[11px] font-mono tabular-nums ${pct >= 90 ? "text-rose-500" : "text-[var(--text-muted)]"}`}>
            {usage.freeTierUsage}/{usage.freeTierLimit}
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}
