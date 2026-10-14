"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/cn";

/*
 * Kit code block chrome (.code): grey tab strip with an indigo top rule on the
 * active tab, a copy button on the right, and a plain <pre> body.
 * The body accepts pre-highlighted children (shiki HTML spans, or the kit's
 * .tok-kw / .tok-fn / .tok-str / .tok-const / .tok-com / .tok-punc spans).
 *
 * Single snippet:  <CodeBlock title="query.js" code={raw}>{highlighted}</CodeBlock>
 * Tabbed:          <CodeBlock tabs={[{ label: "Python", code: raw, content: highlighted }, ...]} />
 * Copy uses `code` when given, otherwise the visible <pre>'s text.
 */

export interface CodeTab {
  label: string;
  /** Raw source, used for copying (and rendered when `content` is absent). */
  code?: string;
  /** Pre-highlighted body. */
  content?: ReactNode;
}

export interface CodeBlockProps {
  /** Tabbed mode. */
  tabs?: CodeTab[];
  /** Initially selected tab index. Default 0. */
  defaultTab?: number;
  /** Single mode: label shown in the strip (e.g. a filename or language). */
  title?: string;
  /** Single mode: raw source for copying (and rendered when there are no children). */
  code?: string;
  /** Single mode: pre-highlighted body. */
  children?: ReactNode;
  /** Hide the copy button. */
  noCopy?: boolean;
  className?: string;
  /** Classes for the <pre> (e.g. a max height). */
  preClassName?: string;
}

export function CodeBlock({
  tabs,
  defaultTab = 0,
  title,
  code,
  children,
  noCopy = false,
  className,
  preClassName,
}: CodeBlockProps) {
  const [active, setActive] = useState(defaultTab);
  const [copied, setCopied] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const baseId = useId();

  useEffect(() => () => clearTimeout(timer.current), []);

  const tab = tabs?.[active];
  const rawCode = tabs ? tab?.code : code;
  const body = tabs ? (tab?.content ?? tab?.code) : (children ?? code);

  async function copy() {
    const text = rawCode ?? preRef.current?.textContent ?? "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable (insecure context); nothing to do */
    }
  }

  return (
    <div className={cn("code", className)}>
      <div className="code__tabs" role={tabs ? "tablist" : undefined}>
        {tabs ? (
          tabs.map((t, i) => (
            <button
              key={t.label}
              type="button"
              role="tab"
              id={`${baseId}-tab-${i}`}
              aria-selected={i === active}
              aria-controls={`${baseId}-panel`}
              tabIndex={i === active ? 0 : -1}
              className="code__tab"
              onClick={() => setActive(i)}
              onKeyDown={(e) => {
                if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                e.preventDefault();
                const next = (active + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
                setActive(next);
                document.getElementById(`${baseId}-tab-${next}`)?.focus();
              }}
            >
              {t.label}
            </button>
          ))
        ) : title ? (
          <span className="code__title">{title}</span>
        ) : null}
        {noCopy ? null : (
          <button type="button" className="code__copy" onClick={copy} aria-label={copied ? "Copied" : "Copy code"}>
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
          </button>
        )}
      </div>
      <pre
        ref={preRef}
        id={`${baseId}-panel`}
        role={tabs ? "tabpanel" : undefined}
        aria-labelledby={tabs ? `${baseId}-tab-${active}` : undefined}
        tabIndex={0}
        className={preClassName}
      >
        <code>{body}</code>
      </pre>
    </div>
  );
}
