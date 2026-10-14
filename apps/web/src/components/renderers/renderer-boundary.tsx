"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { RendererShell } from "./renderer-shell";
import { FallbackTable } from "./table/fallback-table";

/*
 * Error boundary around every heavy renderer. When drawing fails it never takes
 * the message down with it: it shows the rows as a plain table, or the raw JSON.
 */

export interface RendererBoundaryProps {
  children: ReactNode;
  /** Rows to show if rendering fails. */
  rows?: ReadonlyArray<Record<string, unknown>>;
  columns?: readonly string[];
  /** Anything else to show as JSON when there are no rows. */
  raw?: unknown;
  title?: string;
}

interface State {
  error: Error | null;
}

export class RendererBoundary extends Component<RendererBoundaryProps, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[renderers] fell back to data view:", error, info.componentStack);
    }
  }

  componentDidUpdate(prev: RendererBoundaryProps) {
    // New data gets a fresh attempt.
    if (this.state.error && (prev.rows !== this.props.rows || prev.raw !== this.props.raw)) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    const { rows, columns, raw, title } = this.props;
    let json = "";
    if (!rows?.length) {
      try {
        json = JSON.stringify(raw ?? null, null, 2) ?? "";
      } catch {
        json = String(raw);
      }
    }
    return (
      <RendererShell
        title={title}
        caption={
          <span className="inline-flex items-center gap-1.5">
            <CircleAlert className="size-3.5 text-tx-muted" strokeWidth={1.5} aria-hidden="true" />
            Couldn&apos;t draw this chart. Showing the data instead
          </span>
        }
      >
        {rows?.length ? (
          <FallbackTable rows={rows} columns={columns} />
        ) : (
          <pre className="max-h-[320px] overflow-auto rounded-xl bg-sf-secondary p-4 font-mono text-[12px] leading-5 text-tx-secondary">
            {json}
          </pre>
        )}
      </RendererShell>
    );
  }
}
