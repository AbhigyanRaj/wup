import type { ReactNode } from "react";

/*
 * Minimal highlighter for the code the tools produce (mongosh, Node.js,
 * Python, SQL and TypeScript). It emits the kit token classes (.tok-kw,
 * .tok-fn, .tok-str, .tok-const, .tok-com, .tok-punc), so it works in server
 * and client components without a highlighting library.
 */

const KEYWORDS = new Set([
  "const", "let", "await", "import", "from", "export", "new", "return", "interface", "type", "def", "for", "in", "true", "false",
  "null", "None", "True", "False", "list", "SELECT", "FROM", "WHERE", "GROUP", "BY", "ORDER", "HAVING", "JOIN", "LEFT", "ON",
  "AS", "AND", "OR", "NOT", "IN", "IS", "NULL", "LIMIT", "OFFSET", "DESC", "ASC", "DISTINCT", "COUNT", "SUM", "AVG", "LIKE",
  "BETWEEN", "INNER",
]);
const CONSTRUCTORS = new Set(["ObjectId", "ISODate", "Date", "NumberDecimal", "Decimal128", "datetime", "MongoClient", "Schema", "model"]);

const TOKEN =
  /(\/\/[^\n]*|#[^\n]*|--[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|(\$\$?[A-Za-z_][\w]*)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][\w]*)(?=\s*\()|([A-Za-z_][\w]*)|([{}[\]().,:;=<>*])/g;

export function highlight(code: string, lang: "js" | "python" | "sql" | "ts" = "js"): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of code.matchAll(TOKEN)) {
    const start = m.index ?? 0;
    if (start > last) out.push(code.slice(last, start));
    const [text, com, str, op, num, call, word, punc] = m;
    const key = i++;
    if (com !== undefined) {
      const isComment = (lang === "python" && com.startsWith("#")) || (lang === "sql" && com.startsWith("--")) || com.startsWith("//");
      out.push(isComment ? <span key={key} className="tok-com">{text}</span> : text);
    } else if (str !== undefined) {
      out.push(
        <span key={key} className={str.startsWith('"$') || str.startsWith("'$") ? "tok-const" : "tok-str"}>
          {text}
        </span>,
      );
    } else if (op !== undefined) out.push(<span key={key} className="tok-kw">{text}</span>);
    else if (num !== undefined) out.push(<span key={key} className="tok-const">{text}</span>);
    else if (call !== undefined) out.push(<span key={key} className={CONSTRUCTORS.has(call) ? "tok-const" : "tok-fn"}>{text}</span>);
    else if (word !== undefined) {
      out.push(KEYWORDS.has(word) || (lang === "sql" && KEYWORDS.has(word.toUpperCase())) ? <span key={key} className="tok-kw">{text}</span> : text);
    } else if (punc !== undefined) out.push(<span key={key} className="tok-punc">{text}</span>);
    else out.push(text);
    last = start + text.length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}
