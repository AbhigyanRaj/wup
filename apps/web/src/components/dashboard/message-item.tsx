"use client";

import React from "react";
import { motion } from "framer-motion";
import { FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface RagSource { sourceFile: string; pageNumber: number; score: number; }

function CitationPill({ source }: { source: RagSource }) {
  return (
    <span
      title={`Relevance: ${Math.round(source.score * 100)}%`}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium cursor-default transition-all hover:bg-white/[0.08]"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        color: "var(--text-secondary)",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255, 95, 31, 0.3)";
        (e.currentTarget as HTMLElement).style.background = "rgba(255, 95, 31, 0.04)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)";
        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
      }}
    >
      <FileText size={10} className="opacity-50" />
      <span className="truncate tracking-wide" style={{ maxWidth: 140 }}>{source.sourceFile}</span>
      {source.pageNumber > 0 && (
        <span className="opacity-30 ml-0.5">p.{source.pageNumber}</span>
      )}
    </span>
  );
}

export interface MessageProps {
  role: "user" | "assistant";
  content: string;
  ragSources?: RagSource[];
}

export function MessageItem({ role, content, ragSources }: MessageProps) {
  const isAssistant = role === "assistant";
  const hasCitations = isAssistant && ragSources && ragSources.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`w-full ${isAssistant ? "py-8" : "py-4"}`}
    >
      <div className={`flex gap-5 max-w-3xl mx-auto px-6 ${isAssistant ? "items-start" : "justify-end"}`}>

        {isAssistant && (
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-1 shadow-lg overflow-hidden relative group"
            style={{
              background: "var(--bg-sidebar)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--orange)]/10 to-transparent opacity-40" />
            <div className="w-2 h-2 rounded-full bg-[var(--orange)] relative z-10 shadow-[0_0_12px_rgba(255,95,31,0.6)]" />
          </div>
        )}

        {/* Content */}
        <div className={`flex flex-col gap-3 ${isAssistant ? "flex-1" : "max-w-[85%] sm:max-w-[70%]"}`}>
          {isAssistant ? (
            <div className="wup-prose selectable tracking-wide leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>
          ) : (
            <div
              className="selectable px-5 py-3.5 rounded-2xl text-[14.5px] leading-relaxed shadow-sm tracking-wide"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "var(--text-primary)",
              }}
            >
              {content}
            </div>
          )}

          {/* Citations */}
          {hasCitations && (
            <motion.div
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="flex flex-wrap gap-2 items-center pt-3 mt-2 border-t border-white/[0.04]"
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] mr-2 opacity-20 select-none">
                Sources
              </span>
              <div className="flex flex-wrap gap-2">
                {ragSources!.map((src, i) => (
                  <CitationPill key={`${src.sourceFile}-${i}`} source={src} />
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
