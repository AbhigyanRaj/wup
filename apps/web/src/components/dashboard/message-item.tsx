"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Globe, Database, ChevronDown, AlertTriangle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MermaidDiagram } from "./mermaid-diagram";
import { FollowUpChips } from "./follow-up-chips";
import { CodeBlock } from "./code-block";
import { BespokeChart } from "./bespoke-chart";
import { DataTable } from "./data-table";
import { BespokeDiagram } from "./bespoke-diagram";
import { useTheme } from "@/components/theme-provider";
import type { QueryRecord } from "@/lib/bridges";

interface RagSource { sourceFile: string; pageNumber: number; score: number; text?: string; }

export interface WebSource {
  title: string;
  url: string;
}

export interface FollowUpSuggestion {
  label: string;
  suggestedPrompt: string;
}

function CitationPill({ source }: { source: RagSource }) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  
  return (
    <span
      title={`Relevance: ${Math.round(source.score * 100)}%`}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium cursor-default transition-all border"
      style={{
        background: "var(--bg-raised)",
        borderColor: "var(--border)",
        color: "var(--text-secondary)",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(37, 99, 235, 0.3)";
        (e.currentTarget as HTMLElement).style.background = isLight ? "rgba(37, 99, 235, 0.04)" : "rgba(37, 99, 235, 0.06)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
        (e.currentTarget as HTMLElement).style.background = "var(--bg-raised)";
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

function WebCitationPill({ source }: { source: WebSource }) {
  const { theme } = useTheme();
  const isLight = theme === "light";

  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium cursor-pointer transition-all border"
      style={{
        background: "var(--bg-raised)",
        borderColor: "var(--border)",
        color: "var(--text-secondary)",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(37, 99, 235, 0.3)";
        (e.currentTarget as HTMLElement).style.background = isLight ? "rgba(37, 99, 235, 0.04)" : "rgba(37, 99, 235, 0.06)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
        (e.currentTarget as HTMLElement).style.background = "var(--bg-raised)";
      }}
    >
      <Globe size={10} className="opacity-50" />
      <span className="truncate tracking-wide" style={{ maxWidth: 140 }}>{source.title}</span>
    </a>
  );
}

export interface MessageProps {
  role: "user" | "assistant";
  content: string;
  ragSources?: RagSource[];
  webSources?: WebSource[];
  visualType?: "none" | "mermaid" | "chart" | "table" | "diagram";
  chartData?: any;
  tableData?: any;
  diagramData?: any;
  followUps?: FollowUpSuggestion[];
  /** Database queries run to produce this answer */
  queries?: QueryRecord[];
  onFollowUpSelect?: (prompt: string) => void;
}

const TOOL_LABELS: Record<string, string> = {
  mongo_find: "find",
  mongo_count: "count",
  mongo_distinct: "distinct",
  mongo_aggregate: "aggregate",
  mongo_list_sources: "list",
};

/** Collapsible panel listing the exact database queries behind an answer. */
function QueriesUsed({ queries }: { queries: QueryRecord[] }) {
  const [open, setOpen] = useState(false);
  const failed = queries.filter((q) => q.error).length;
  const totalMs = queries.reduce((n, q) => n + (q.durationMs || 0), 0);

  return (
    <div className="mt-4 rounded-xl border border-[var(--border)] overflow-hidden not-prose">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left hover:bg-[var(--bg-highlight)]/40 transition-colors cursor-pointer"
      >
        <Database size={12} className="text-[var(--text-muted)]" />
        <span className="text-[11.5px] font-medium text-[var(--text-secondary)]">
          {queries.length === 1 ? "Query used" : `${queries.length} queries used`}
        </span>
        <span className="text-[11px] text-[var(--text-muted)] truncate">
          · {Array.from(new Set(queries.map((q) => `${q.db}.${q.collection}`))).join(", ")}
        </span>
        {failed > 0 && (
          <span className="inline-flex items-center gap-1 text-[10.5px] text-[var(--amber)]">
            <AlertTriangle size={10} />{failed} failed
          </span>
        )}
        <span className="ml-auto text-[10.5px] tabular-nums text-[var(--text-muted)]">{totalMs}ms</span>
        <ChevronDown size={13} className={`text-[var(--text-muted)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-[var(--border)] divide-y divide-[var(--border)]">
          {queries.map((q, i) => (
            <div key={i} className="px-3.5 py-3 space-y-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                <span className="px-1.5 py-0.5 rounded-md bg-[var(--orange)]/10 text-[var(--orange)] font-mono font-semibold">
                  {TOOL_LABELS[q.tool] ?? q.tool}
                </span>
                <span className="font-mono text-[var(--text-primary)]">{q.db}.{q.collection}</span>
                <span className="text-[var(--text-muted)]">on {q.connectionName}</span>
                <span className="ml-auto text-[var(--text-muted)] tabular-nums">
                  {q.error ? "failed" : `${q.rowCount.toLocaleString("en-US")} row${q.rowCount === 1 ? "" : "s"}${q.truncated ? " (limited)" : ""}`} · {q.durationMs}ms
                </span>
              </div>
              {q.error && <p className="text-[11.5px] text-[var(--amber)]">{q.error}</p>}
              <CodeBlock language="json" value={q.query} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Interactive Inline Citation Cards ───────────────────────────────────────

function CitationCard({ index, text, ragSources }: { index: number; text: string; ragSources: RagSource[] }) {
  const [hovered, setHovered] = useState(false);
  const source = ragSources && ragSources[index - 1];

  if (!source) {
    return <span className="opacity-60">{text}</span>;
  }

  return (
    <span
      className="relative inline-block text-left"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-500 dark:text-blue-400 text-[10px] font-bold cursor-help transition-all hover:bg-blue-500/20 select-none">
        {text}
      </span>

      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-4 rounded-xl shadow-2xl z-50 text-left cursor-default leading-relaxed border"
            style={{
              background: "var(--bg-overlay)",
              borderColor: "var(--border)",
            }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] pb-2 mb-2 select-none">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--orange)]">
                Source Document
              </span>
              <span className="text-[9px] font-mono text-[var(--text-muted)]">
                Match: {Math.round(source.score * 100)}%
              </span>
            </div>
            
            <p className="text-[11px] font-medium text-[var(--text-primary)] max-h-24 overflow-y-auto custom-scrollbar select-text italic mb-2">
              "{source.text || "No preview text available for this source."}"
            </p>
            
            <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] select-none pt-1">
              <FileText size={9} />
              <span className="truncate max-w-[150px]">{source.sourceFile}</span>
              {source.pageNumber > 0 && <span>p.{source.pageNumber}</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

function preprocessContent(text: string) {
  return text.replace(/\[([1-9][0-9]?)\](?!\()/g, "[$1](#citation-$1)");
}

function MarkdownCodeBlock({ node, className, children, ...props }: any) {
  const match = /language-(\w+)/.exec(className || "");
  const lang = match?.[1];
  const code = String(children).replace(/\n$/, "");

  if (lang === "mermaid") {
    return <MermaidDiagram code={code} />;
  }

  if (lang) {
    return <CodeBlock language={lang} value={code} />;
  }

  return (
    <code
      className={className}
      style={{
        background: "var(--bg-raised)",
        border: "1px solid var(--border)",
        borderRadius: "6px",
        padding: "2px 6px",
        fontSize: "12.5px",
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        display: "inline",
      }}
      {...props}
    >
      {children}
    </code>
  );
}

export function MessageItem({ role, content, ragSources, webSources, visualType, chartData, tableData, diagramData, followUps, queries, onFollowUpSelect }: MessageProps) {
  const isAssistant = role === "assistant";
  const hasCitations = isAssistant && ((ragSources && ragSources.length > 0) || (webSources && webSources.length > 0));
  const hasFollowUps = isAssistant && followUps && followUps.length > 0 && onFollowUpSelect;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`w-full ${isAssistant ? "py-8" : "py-4"}`}
    >
      <div className={`flex gap-5 max-w-3xl mx-auto px-6 ${isAssistant ? "items-start" : "justify-end"}`}>

        {isAssistant && (
          <div className="flex flex-col items-center gap-2 shrink-0 mt-1">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shadow-lg overflow-hidden relative group"
              style={{
                background: "var(--bg-sidebar)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--orange)]/10 to-transparent opacity-40" />
              <div className="w-2 h-2 rounded-full bg-[var(--orange)] relative z-10 shadow-[0_0_12px_rgba(37,99,235,0.45)]" />
            </div>
            {webSources && webSources.length > 0 && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-[8px] font-extrabold tracking-wider uppercase text-blue-500 dark:text-blue-400 bg-blue-500/5 border border-blue-500/15 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 select-none"
                title="Grounded in real-time Web Search"
              >
                <Globe size={8} />
                Web
              </motion.span>
            )}
          </div>
        )}

        {/* Content */}
        <div className={`flex flex-col gap-3 ${isAssistant ? "flex-1" : "max-w-[85%] sm:max-w-[70%]"}`}>
          {isAssistant ? (
            <div className="wuup-prose selectable tracking-wide leading-relaxed">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{ 
                  code: MarkdownCodeBlock,
                  a: ({ href, children, ...props }: any) => {
                    if (href && href.startsWith("#citation-")) {
                      const index = parseInt(href.replace("#citation-", ""), 10);
                      return <CitationCard index={index} text={children} ragSources={ragSources || []} />;
                    }
                    return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
                  }
                }}
              >
                {preprocessContent(content)}
              </ReactMarkdown>

              {/* Render Bespoke Charts if visualType is chart */}
              {visualType === "chart" && chartData && (
                <BespokeChart data={chartData} />
              )}

              {/* Render DataTable if visualType is table */}
              {visualType === "table" && tableData && (
                <DataTable data={tableData} />
              )}

              {/* Render Bespoke Diagram if visualType is diagram */}
              {visualType === "diagram" && diagramData && (
                <BespokeDiagram data={diagramData} />
              )}

              {/* Exact database queries behind this answer */}
              {queries && queries.length > 0 && <QueriesUsed queries={queries} />}
            </div>
          ) : (
            <div
              className="selectable px-5 py-3.5 rounded-2xl text-[14.5px] leading-relaxed shadow-sm tracking-wide border"
              style={{
                background: "var(--bg-raised)",
                borderColor: "var(--border)",
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
              className="flex flex-wrap gap-2 items-center pt-3 mt-2 border-t border-[var(--border)]"
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] mr-2 text-[var(--text-muted)] select-none">
                Sources
              </span>
              <div className="flex flex-wrap gap-2">
                {ragSources?.map((src, i) => (
                  <CitationPill key={`rag-${src.sourceFile}-${i}`} source={src} />
                ))}
                {webSources?.map((src, i) => (
                  <WebCitationPill key={`web-${i}`} source={src} />
                ))}
              </div>
            </motion.div>
          )}

          {/* Follow-up Chips */}
          {hasFollowUps && (
            <FollowUpChips
              followUps={followUps!}
              onSelect={onFollowUpSelect!}
            />
          )}
        </div>
      </div>
    </motion.div>
  );
}
