/*
 * Lazy syntax highlighting: Prism *light* build plus a fixed set of grammars,
 * loaded on first use. Components paint plain text first and upgrade when this resolves.
 */

import type { ComponentType, CSSProperties } from "react";
import type { SyntaxHighlighterProps } from "react-syntax-highlighter";

type Highlighter = ComponentType<SyntaxHighlighterProps> & {
  registerLanguage: (name: string, grammar: unknown) => void;
};

const ALIASES: Record<string, string> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  node: "javascript",
  ts: "typescript",
  mts: "typescript",
  py: "python",
  python3: "python",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  console: "bash",
  shellsession: "bash",
  yml: "yaml",
  md: "markdown",
  mdx: "markdown",
  html: "markup",
  xml: "markup",
  svg: "markup",
  jsonc: "json",
  json5: "json",
  mongodb: "javascript",
  mongo: "javascript",
  postgres: "sql",
  postgresql: "sql",
  mysql: "sql",
};

export const HIGHLIGHT_LANGUAGES = [
  "json",
  "javascript",
  "typescript",
  "jsx",
  "tsx",
  "python",
  "sql",
  "bash",
  "yaml",
  "markdown",
  "css",
  "markup",
] as const;

const LABELS: Record<string, string> = {
  json: "JSON",
  javascript: "JavaScript",
  typescript: "TypeScript",
  jsx: "JSX",
  tsx: "TSX",
  python: "Python",
  sql: "SQL",
  bash: "Shell",
  yaml: "YAML",
  markdown: "Markdown",
  css: "CSS",
  markup: "HTML",
};

/** Canonical grammar name, or null when we do not ship a grammar for it. */
export function resolveLanguage(lang: string | undefined | null): string | null {
  const l = (lang ?? "").trim().toLowerCase();
  if (!l) return null;
  const name = ALIASES[l] ?? l;
  return (HIGHLIGHT_LANGUAGES as readonly string[]).includes(name) ? name : null;
}

export function languageLabel(lang: string | undefined | null): string {
  const resolved = resolveLanguage(lang);
  if (resolved) return LABELS[resolved] ?? resolved;
  const l = (lang ?? "").trim();
  return l ? l : "Text";
}

let loader: Promise<Highlighter> | null = null;

export function loadHighlighter(): Promise<Highlighter> {
  if (loader) return loader;
  loader = (async () => {
    const [core, json, javascript, typescript, jsx, tsx, python, sql, bash, yaml, markdown, css, markup] =
      await Promise.all([
        import("react-syntax-highlighter/dist/esm/prism-light"),
        import("react-syntax-highlighter/dist/esm/languages/prism/json"),
        import("react-syntax-highlighter/dist/esm/languages/prism/javascript"),
        import("react-syntax-highlighter/dist/esm/languages/prism/typescript"),
        import("react-syntax-highlighter/dist/esm/languages/prism/jsx"),
        import("react-syntax-highlighter/dist/esm/languages/prism/tsx"),
        import("react-syntax-highlighter/dist/esm/languages/prism/python"),
        import("react-syntax-highlighter/dist/esm/languages/prism/sql"),
        import("react-syntax-highlighter/dist/esm/languages/prism/bash"),
        import("react-syntax-highlighter/dist/esm/languages/prism/yaml"),
        import("react-syntax-highlighter/dist/esm/languages/prism/markdown"),
        import("react-syntax-highlighter/dist/esm/languages/prism/css"),
        import("react-syntax-highlighter/dist/esm/languages/prism/markup"),
      ]);
    const Prism = core.default as unknown as Highlighter;
    const grammars = { json, javascript, typescript, jsx, tsx, python, sql, bash, yaml, markdown, css, markup };
    for (const [name, mod] of Object.entries(grammars)) Prism.registerLanguage(name, mod.default);
    return Prism;
  })().catch((err: unknown) => {
    loader = null;
    throw err;
  });
  return loader;
}

/* Kit light theme (token colours from the design kit .code block). */
const KW = "#3333cc";
const FN = "#212191";
const STR = "#496d21";
const NUM = "#9d2055";
const COM = "#666666";
const PUNC = "#4d4d4d";

const c = (color: string, extra: CSSProperties = {}): CSSProperties => ({ color, ...extra });

export const KIT_CODE_THEME: Record<string, CSSProperties> = {
  'code[class*="language-"]': { color: "#1f1f1f", background: "none" },
  'pre[class*="language-"]': { color: "#1f1f1f", background: "none" },
  comment: c(COM),
  prolog: c(COM),
  doctype: c(COM),
  cdata: c(COM),
  punctuation: c(PUNC),
  operator: c(PUNC),
  keyword: c(KW),
  atrule: c(KW),
  important: c(KW),
  tag: c(KW),
  selector: c(KW),
  rule: c(KW),
  "attr-name": c(FN),
  property: c(FN),
  function: c(FN),
  "function-variable": c(FN),
  "class-name": c(FN),
  builtin: c(FN),
  string: c(STR),
  char: c(STR),
  "attr-value": c(STR),
  regex: c(STR),
  url: c(STR),
  inserted: c(STR),
  "template-string": c(STR),
  number: c(NUM),
  boolean: c(NUM),
  constant: c(NUM),
  symbol: c(NUM),
  deleted: c(NUM),
  entity: c(NUM),
  variable: c("#1f1f1f"),
  title: c(KW, { fontWeight: 525 }),
  bold: { fontWeight: 525 },
  italic: { fontStyle: "italic" },
};
