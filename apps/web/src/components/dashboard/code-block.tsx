"use client";

import React, { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
// We use a custom styled variant of vscDarkPlus or custom dark styles
import { Check, Copy } from "lucide-react";

interface CodeBlockProps {
  language: string;
  value: string;
}

export function CodeBlock({ language, value }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code: ", err);
    }
  };

  return (
    <div
      className="w-full my-4 overflow-hidden rounded-2xl shadow-xl"
      style={{
        background: "#0c0d12",
        border: "1px solid rgba(255, 255, 255, 0.08)",
      }}
    >
      {/* Terminal Title Bar */}
      <div
        className="flex items-center justify-between px-5 py-3 select-none"
        style={{
          borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
          background: "rgba(255, 255, 255, 0.01)",
        }}
      >
        {/* Mac OS Window Buttons */}
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
          <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
          <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
          <span className="text-[11px] font-medium tracking-wider ml-2 opacity-30 uppercase">
            {language || "code"}
          </span>
        </div>

        {/* Copy Trigger */}
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1.2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer hover:bg-white/[0.06] select-none"
          style={{
            color: copied ? "var(--green)" : "var(--text-secondary)",
          }}
        >
          {copied ? (
            <>
              <Check size={11} className="stroke-[3px]" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy size={11} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Container */}
      <div className="p-4 text-xs font-mono overflow-auto custom-scrollbar leading-relaxed">
        <SyntaxHighlighter
          language={language || "javascript"}
          style={customDarkTheme}
          PreTag="div"
          customStyle={{
            background: "transparent",
            padding: 0,
            margin: 0,
            fontSize: "12px",
          }}
        >
          {value}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

// Custom High-Contrast Premium Dark Theme Object
const customDarkTheme: any = {
  'code[class*="language-"]': {
    color: "#f8f8f2",
    background: "none",
    fontFamily: "Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace",
    textAlign: "left",
    whiteSpace: "pre",
    wordSpacing: "normal",
    wordBreak: "normal",
    wordWrap: "normal",
    lineHeight: "1.5",
    tabSize: "4",
    hyphens: "none",
  },
  'comment': { color: "#6272a4", fontStyle: "italic" },
  'prolog': { color: "#6272a4" },
  'doctype': { color: "#6272a4" },
  'cdata': { color: "#6272a4" },
  'punctuation': { color: "#f8f8f2" },
  'property': { color: "#ff79c6" },
  'tag': { color: "#ff79c6" },
  'constant': { color: "#bd93f9" },
  'symbol': { color: "#bd93f9" },
  'deleted': { color: "#ff5555" },
  'boolean': { color: "#bd93f9" },
  'number': { color: "#bd93f9" },
  'selector': { color: "#50fa7b" },
  'attr-name': { color: "#50fa7b" },
  'string': { color: "#f1fa8c" },
  'char': { color: "#50fa7b" },
  'builtin': { color: "#50fa7b" },
  'inserted': { color: "#50fa7b" },
  'operator': { color: "#ff79c6" },
  'entity': { color: "#ff79c6", cursor: "help" },
  'url': { color: "#ff79c6" },
  'variable': { color: "#50fa7b" },
  'atrule': { color: "#ff79c6" },
  'attr-value': { color: "#f1fa8c" },
  'function': { color: "#ffb86c" },
  'class-name': { color: "#8be9fd" },
  'keyword': { color: "#ff79c6" },
  'regex': { color: "#ffb86c" },
  'important': { color: "#ffb86c", fontWeight: "bold" },
  'bold': { fontWeight: "bold" },
  'italic': { fontStyle: "italic" },
};
