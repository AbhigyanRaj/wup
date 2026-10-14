import type { MessageDTO } from "@/lib/types";
import { stripMeta } from "@/lib/markdown/holdback";
import { unifySources, domainOf } from "@/lib/sources";

/*
 * Client-side Markdown export of a chat (used when GET /chats/:id/export is
 * unavailable). Answers keep their [n] markers, with a numbered source list
 * and the queries used under each one.
 */

function sourceLine(m: MessageDTO): string[] {
  return unifySources(m).map((s) => {
    if (s.kind === "web") return `${s.n}. [${s.title}](${s.url}) (${domainOf(s.url)})`;
    if (s.kind === "doc") return `${s.n}. ${s.title}${s.page ? `, page ${s.page}` : ""}`;
    return `${s.n}. ${s.connectionName}: ${s.db}.${s.collection}`;
  });
}

export function chatToMarkdown(title: string, messages: MessageDTO[], exportedAt = new Date()): string {
  const out: string[] = [`# ${title || "Chat"}`, "", `_Exported from wuup on ${exportedAt.toISOString().slice(0, 10)}_`, ""];
  for (const m of messages) {
    if (m.role === "user") {
      out.push("## You", "", m.content.trim(), "");
      continue;
    }
    out.push("## wuup", "", stripMeta(m.content).trim() || "_No answer_", "");
    const sources = sourceLine(m);
    if (sources.length) out.push("**Sources**", "", ...sources, "");
    if (m.queries?.length) {
      out.push("**Queries used**", "");
      for (const q of m.queries) {
        out.push(`- \`${q.tool}\` on ${q.db}.${q.collection} (${q.rowCount} rows, ${q.durationMs}ms)`, "", "```json", q.query, "```", "");
      }
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "chat"
  );
}

export function downloadText(filename: string, text: string, type = "text/markdown;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
