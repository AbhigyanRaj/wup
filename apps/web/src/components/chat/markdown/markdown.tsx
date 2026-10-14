"use client";

import * as React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Element, ElementContent } from "hast";
import { remarkCitations } from "@/lib/markdown/remark-citations";
import { holdback } from "@/lib/markdown/holdback";
import { splitBlocks, splitOpenFence } from "@/lib/markdown/fences";
import { Citation } from "../citation";
import { HighlightedCode, MermaidBlock } from "../renderers";
import { PendingBlock } from "./pending-block";
import styles from "./prose.module.css";

/*
 * Answer markdown.
 *
 * - Plugins and the components map live at module scope, so no component
 *   identity changes between renders (the old inline `a` remounted links).
 * - The text is split into top-level blocks; each block is memoised on its
 *   text, so while streaming only the last block re-parses.
 * - While streaming, an unterminated trailing fence is split off and shown as
 *   a PendingBlock (mermaid never sees half a diagram).
 */

const REMARK_PLUGINS = [remarkGfm, remarkCitations];

function hastText(node: ElementContent | Element): string {
  if (node.type === "text") return node.value;
  if ("children" in node) return node.children.map((c) => hastText(c as ElementContent)).join("");
  return "";
}

function codeLanguage(code: Element): string {
  const cls: unknown = code.properties?.className;
  const list: string[] = Array.isArray(cls) ? cls.map(String) : typeof cls === "string" ? cls.split(" ") : [];
  const lang = list.find((c) => c.startsWith("language-"));
  return lang ? lang.slice("language-".length).toLowerCase() : "";
}

const MdPre: Components["pre"] = ({ node }) => {
  const code = node?.children.find((c): c is Element => c.type === "element" && c.tagName === "code");
  if (!code) return null;
  const lang = codeLanguage(code);
  const value = hastText(code).replace(/\n$/, "");
  if (lang === "mermaid") return <MermaidBlock code={value} />;
  return <HighlightedCode language={lang || null} value={value} />;
};

const MdLink: Components["a"] = ({ node, href, children, ...rest }) => {
  void node;
  const external = !!href && /^https?:\/\//i.test(href);
  const safe = href && /^(https?:|mailto:|#|\/)/i.test(href) ? href : undefined;
  return (
    <a
      {...rest}
      href={safe}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </a>
  );
};

const MdSup: Components["sup"] = ({ node, children, ...rest }) => {
  void node;
  const n = Number((rest as Record<string, unknown>)["data-citation"]);
  if (Number.isInteger(n) && n > 0) return <Citation n={n} />;
  return <sup {...rest}>{children}</sup>;
};

const MdTable: Components["table"] = ({ node, children, ...rest }) => {
  void node;
  return (
    <div className={styles.tableWrap}>
      <table {...rest}>{children}</table>
    </div>
  );
};

const COMPONENTS: Components = {
  pre: MdPre,
  a: MdLink,
  sup: MdSup,
  table: MdTable,
};

const Block = React.memo(function Block({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={COMPONENTS}>
      {text}
    </ReactMarkdown>
  );
});

export interface MarkdownProps {
  content: string;
  /** True while tokens are still arriving. */
  streaming?: boolean;
  className?: string;
}

export function Markdown({ content, streaming = false, className }: MarkdownProps) {
  const safe = holdback(content, streaming);
  const { complete, pending } = React.useMemo(
    () => (streaming ? splitOpenFence(safe) : { complete: safe, pending: null }),
    [safe, streaming],
  );
  const blocks = React.useMemo(() => splitBlocks(complete), [complete]);

  return (
    <div className={[styles.prose, className].filter(Boolean).join(" ")}>
      {blocks.map((text, i) => (
        // Blocks are positional and append-only: block i stays block i while
        // streaming, so its position is its identity.
        <Block key={`b${i}`} text={text} />
      ))}
      {pending ? <PendingBlock lang={pending.lang} code={pending.code} /> : null}
    </div>
  );
}

export { styles as proseStyles };
