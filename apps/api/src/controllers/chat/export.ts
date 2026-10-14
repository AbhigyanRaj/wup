import type { Response } from "express";
import { z } from "zod";
import type { MessageDTO } from "@wup/contracts";
import { Chat, Message } from "@wup/models";
import { toChatSummary } from "../../dto/chat";
import { toMessageDTO } from "../../dto/message";
import { asyncHandler, getUserId, notFound } from "./deps";

/**
 * GET /chats/:chatId/export?format=md
 * GET /chats/:chatId/messages/:messageId/export?format=md
 *
 * Markdown download: title, date, each turn ("You" / "wuup"), queries as fenced
 * JSON, tables as GFM (max 50 rows), research steps and a numbered source list.
 */

export const ExportQuerySchema = z.object({
  format: z.enum(["md"]).default("md"),
});

export const EXPORT_TABLE_ROWS = 50;

export function slugify(input: string, fallback = "wuup-chat"): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || fallback;
}

const fence = (body: string, lang = "") => {
  let ticks = "```";
  while (body.includes(ticks)) ticks += "`";
  return `${ticks}${lang}\n${body}\n${ticks}`;
};

const cell = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return s.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
};

function tableMarkdown(columns: string[], rows: Array<Record<string, unknown>>): string {
  const head = `| ${columns.map(cell).join(" | ")} |`;
  const sep = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows.slice(0, EXPORT_TABLE_ROWS).map((r) => `| ${columns.map((c) => cell(r?.[c])).join(" | ")} |`);
  const more = rows.length > EXPORT_TABLE_ROWS ? [``, `_${rows.length - EXPORT_TABLE_ROWS} more rows not shown._`] : [];
  return [head, sep, ...body, ...more].join("\n");
}

function sourceLine(s: MessageDTO["sources"][number]): string {
  switch (s.kind) {
    case "web":
      return `${s.n}. [${s.title || s.url}](${s.url})`;
    case "doc":
      return `${s.n}. ${s.title || "Document"}${s.page != null ? `, page ${s.page}` : ""}`;
    case "data":
      return `${s.n}. ${s.connectionName}: ${s.db}.${s.collection}`;
  }
}

export function messageMarkdown(m: MessageDTO): string {
  const parts: string[] = [`### ${m.role === "user" ? "You" : "wuup"}`, ""];
  const content = m.content.trim();
  if (content) parts.push(content, "");
  if (m.status === "stopped") parts.push("_Stopped before the answer was complete._", "");
  if (m.status === "error") parts.push(`_Error: ${m.error?.message ?? "the answer failed"}_`, "");

  if (m.role === "assistant") {
    if (m.research && m.research.steps.length) {
      parts.push("**Research steps**", "");
      m.research.steps.forEach((s, i) => parts.push(`${i + 1}. ${s.title} (${s.status})${s.detail ? `: ${s.detail}` : ""}`));
      parts.push("");
    }
    for (const q of m.queries) {
      const where = [q.connectionName, [q.db, q.collection].filter(Boolean).join(".")].filter(Boolean).join(": ");
      parts.push(`**Query used**${where ? ` (${where})` : ""}`, "", fence(q.query, "json"), "");
    }
    if (m.tableData && m.tableData.columns.length) {
      parts.push(tableMarkdown(m.tableData.columns, m.tableData.rows as Array<Record<string, unknown>>), "");
    }
    if (m.sources.length) {
      parts.push("**Sources**", "", ...m.sources.map(sourceLine), "");
    }
  }
  return parts.join("\n");
}

function documentMarkdown(title: string, messages: MessageDTO[]): string {
  const date = new Date().toISOString().slice(0, 10);
  return [`# ${title}`, "", `_Exported from wuup on ${date}_`, "", "---", "", messages.map(messageMarkdown).join("\n---\n\n")].join("\n").trimEnd() + "\n";
}

function sendMarkdown(res: Response, filename: string, body: string) {
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(body);
}

export const exportChat = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { chatId } = req.params;
  const chat: any = await Chat.findOne({ _id: chatId, userId }).lean();
  if (!chat) throw notFound("Chat");
  const docs = await Message.find({ chatId, role: { $in: ["user", "assistant"] } }).sort({ createdAt: 1, _id: 1 }).lean();
  const summary = toChatSummary(chat);
  sendMarkdown(res, `${slugify(summary.title)}.md`, documentMarkdown(summary.title, docs.map(toMessageDTO)));
});

export const exportMessage = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { chatId, messageId } = req.params;
  const chat: any = await Chat.findOne({ _id: chatId, userId }).lean();
  if (!chat) throw notFound("Chat");
  const msg: any = await Message.findOne({ _id: messageId, chatId }).lean();
  if (!msg) throw notFound("Message");

  const docs: any[] = [];
  // An answer is exported with the question it answers.
  if (msg.role === "assistant") {
    const parent = msg.parentId
      ? await Message.findOne({ _id: msg.parentId, chatId }).lean()
      : await Message.findOne({ chatId, role: "user", createdAt: { $lte: msg.createdAt } }).sort({ createdAt: -1, _id: -1 }).lean();
    if (parent) docs.push(parent);
  }
  docs.push(msg);
  const summary = toChatSummary(chat);
  sendMarkdown(
    res,
    `${slugify(summary.title)}-${String(msg._id).slice(-6)}.md`,
    documentMarkdown(summary.title, docs.map(toMessageDTO))
  );
});
