"use client";

import * as React from "react";
import { Check, Database, FileText, Globe, Sheet, X } from "lucide-react";
import type { StreamStatus, StreamTool } from "@/lib/stream-store";
import { cn } from "@/lib/cn";
import styles from "./thinking.module.css";

/*
 * Live progress before the first token: what wuup is doing right now
 * (statuses and tool calls) and how long it has been working.
 */

function useElapsed(since: number, running: boolean) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);
  return Math.max(0, Math.round((now - since) / 1000));
}

function toolIcon(name: string) {
  if (/sheet/i.test(name)) return Sheet;
  if (/web|search/i.test(name)) return Globe;
  if (/doc|rag|knowledge/i.test(name)) return FileText;
  return Database;
}

type Row =
  | { kind: "status"; key: string; text: string; at: number }
  | { kind: "tool"; key: string; tool: StreamTool; at: number };

export function ThinkingSteps({
  statuses,
  tools,
  startedAt,
  label = "Thinking",
}: {
  statuses: StreamStatus[];
  tools: StreamTool[];
  startedAt: number;
  label?: string;
}) {
  const elapsed = useElapsed(startedAt, true);
  const rows: Row[] = [
    ...statuses.map((s) => ({ kind: "status" as const, key: `s-${s.at}-${s.message}`, text: s.message, at: s.at })),
    ...tools.map((t) => ({ kind: "tool" as const, key: `t-${t.id}`, tool: t, at: t.at })),
  ].sort((a, b) => a.at - b.at);
  const visible = rows.slice(-5);
  const last = visible[visible.length - 1];

  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-2.5 py-1">
      <div className="flex items-center gap-2.5">
        <span className={styles.orb} aria-hidden="true" />
        <span className={cn("text-[15px] font-medium", styles.shimmer)}>{label}</span>
        <span className="text-[13px] tabular-nums text-tx-muted" aria-label={`${elapsed} seconds`}>
          {elapsed}s
        </span>
      </div>
      {visible.length > 0 ? (
        <ul className="ml-[5px] flex flex-col gap-1.5 border-l border-st pl-4">
          {visible.map((row) => {
            const current = row === last;
            if (row.kind === "status") {
              return (
                <li
                  key={row.key}
                  className={cn(
                    "flex items-center gap-2 text-[14px] leading-6",
                    styles.rowIn,
                    current ? "text-tx-secondary" : "text-tx-muted",
                  )}
                >
                  {current ? (
                    <span className={styles.dot} aria-hidden="true" />
                  ) : (
                    <Check className="size-3.5 text-indigo-600" strokeWidth={2} aria-hidden="true" />
                  )}
                  <span className="truncate">{row.text}</span>
                </li>
              );
            }
            const Icon = toolIcon(row.tool.name);
            const state = row.tool.state;
            return (
              <li key={row.key} className={cn("flex items-center gap-2 text-[14px] leading-6 text-tx-secondary", styles.rowIn)}>
                <Icon className="size-3.5 text-tx-tertiary" strokeWidth={1.5} aria-hidden="true" />
                <span className="truncate">{row.tool.label || row.tool.name}</span>
                {state === "running" ? (
                  <span className={styles.dot} aria-label="running" />
                ) : state === "done" ? (
                  <Check className="size-3.5 text-indigo-600" strokeWidth={2} aria-label="done" />
                ) : (
                  <X className="size-3.5 text-red-400" strokeWidth={2} aria-label="failed" />
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/** Three-dot indicator shown under text that is still streaming. */
export function TypingDots({ className }: { className?: string }) {
  return (
    <span className={cn(styles.typing, className)} role="status" aria-label="wuup is writing">
      <span />
      <span />
      <span />
    </span>
  );
}
