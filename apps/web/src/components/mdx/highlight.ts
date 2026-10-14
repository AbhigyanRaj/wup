import { createHighlighter, type Highlighter, type ThemeRegistration } from "shiki";

/*
 * Server-side syntax highlighting for MDX code fences.
 * The theme is built from the kit code tokens (components.css .tok-*):
 * keyword #3333cc, function #212191, string #496d21, constant #0369a1,
 * comment #666, punctuation #4d4d4d, plain #1f1f1f on #fafafa.
 */

const KIT_LIGHT: ThemeRegistration = {
  name: "wuup-kit-light",
  type: "light",
  colors: {
    "editor.background": "#fafafa",
    "editor.foreground": "#1f1f1f",
  },
  tokenColors: [
    { settings: { foreground: "#1f1f1f" } },
    { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: "#666666" } },
    {
      scope: ["keyword", "storage", "storage.type", "storage.modifier", "keyword.control", "keyword.other"],
      settings: { foreground: "#3333cc" },
    },
    { scope: ["keyword.operator"], settings: { foreground: "#4d4d4d" } },
    {
      scope: ["entity.name.function", "support.function", "meta.function-call entity.name.function", "variable.function"],
      settings: { foreground: "#212191" },
    },
    { scope: ["string", "string.quoted", "string.template", "punctuation.definition.string"], settings: { foreground: "#496d21" } },
    {
      scope: ["constant.numeric", "constant.language", "constant.character", "support.constant", "variable.language"],
      settings: { foreground: "#0369a1" },
    },
    {
      scope: ["support.type.property-name.json", "support.type.property-name", "meta.object-literal.key"],
      settings: { foreground: "#212191" },
    },
    { scope: ["entity.name.type", "support.type", "support.class", "entity.name.class"], settings: { foreground: "#3333cc" } },
    { scope: ["punctuation", "meta.brace", "punctuation.separator", "punctuation.terminator"], settings: { foreground: "#4d4d4d" } },
    { scope: ["variable", "variable.other", "variable.parameter"], settings: { foreground: "#1f1f1f" } },
  ],
};

/** Fence language -> [shiki language, label shown in the code strip]. */
const LANGS: Record<string, [string, string]> = {
  js: ["javascript", "JavaScript"],
  javascript: ["javascript", "JavaScript"],
  mongosh: ["javascript", "mongosh"],
  mongodb: ["javascript", "mongosh"],
  ts: ["typescript", "TypeScript"],
  typescript: ["typescript", "TypeScript"],
  json: ["json", "JSON"],
  jsonc: ["jsonc", "JSON"],
  sql: ["sql", "SQL"],
  bash: ["bash", "Shell"],
  sh: ["bash", "Shell"],
  shell: ["bash", "Shell"],
  python: ["python", "Python"],
  py: ["python", "Python"],
  gs: ["javascript", "Apps Script"],
  appsscript: ["javascript", "Apps Script"],
  text: ["text", "Text"],
  txt: ["text", "Text"],
  http: ["http", "HTTP"],
};

const SHIKI_LANGS = ["javascript", "typescript", "json", "jsonc", "sql", "bash", "python", "http"] as const;

let highlighter: Promise<Highlighter> | null = null;

function getHighlighter() {
  highlighter ??= createHighlighter({ themes: [KIT_LIGHT], langs: [...SHIKI_LANGS] });
  return highlighter;
}

export function languageLabel(lang: string | undefined): string {
  if (!lang) return "Code";
  return LANGS[lang.toLowerCase()]?.[1] ?? lang;
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Highlighted inner HTML of the <code> element (lines as spans). Falls back to escaped text. */
export async function highlightToHtml(code: string, lang: string | undefined): Promise<string> {
  const shikiLang = LANGS[(lang ?? "text").toLowerCase()]?.[0] ?? "text";
  if (shikiLang === "text") return escapeHtml(code);
  try {
    const hl = await getHighlighter();
    const html = hl.codeToHtml(code, { lang: shikiLang, theme: KIT_LIGHT.name! });
    const inner = html.match(/<code[^>]*>([\s\S]*)<\/code>/)?.[1];
    return inner ?? escapeHtml(code);
  } catch {
    return escapeHtml(code);
  }
}
