/*
 * Fence-aware helpers for streaming markdown.
 *
 * splitOpenFence: while an answer streams, a trailing ``` block that has not
 * been closed yet would make react-markdown treat the rest of the text as code
 * (and mermaid would try to render half a diagram). The open block is split off
 * and rendered as a PendingBlock instead.
 *
 * splitBlocks: splits markdown into top-level chunks (blank-line separated,
 * never inside a fence, list continuations kept together) so each chunk can
 * be memoised and only the last one re-parses while tokens arrive.
 */

interface FenceOpen {
  char: "`" | "~";
  len: number;
  indent: number;
}

const FENCE_RE = /^( {0,3})(`{3,}|~{3,})(.*)$/;

function openFence(line: string): (FenceOpen & { info: string }) | null {
  const m = FENCE_RE.exec(line);
  if (!m) return null;
  const run = m[2];
  const info = m[3].trim();
  // A backtick fence's info string may not contain backticks.
  if (run[0] === "`" && info.includes("`")) return null;
  return { char: run[0] as "`" | "~", len: run.length, indent: m[1].length, info };
}

function closesFence(line: string, open: FenceOpen): boolean {
  const m = /^( {0,3})(`{3,}|~{3,})\s*$/.exec(line);
  return !!m && m[2][0] === open.char && m[2].length >= open.len;
}

export interface PendingFence {
  /** Language from the info string ("mermaid", "json", "" when none). */
  lang: string;
  /** Code received so far (without the opening fence line). */
  code: string;
}

export interface OpenFenceSplit {
  /** Markdown before the unterminated fence (or the whole text). */
  complete: string;
  pending: PendingFence | null;
}

export function splitOpenFence(markdown: string): OpenFenceSplit {
  const lines = markdown.split("\n");
  let open: (FenceOpen & { info: string; line: number; offset: number }) | null = null;
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (open) {
      if (closesFence(line, open)) open = null;
    } else {
      const f = openFence(line);
      if (f) open = { ...f, line: i, offset };
    }
    offset += line.length + 1;
  }
  if (!open) return { complete: markdown, pending: null };
  const complete = markdown.slice(0, open.offset).replace(/\s+$/, "");
  const code = lines.slice(open.line + 1).join("\n");
  const lang = (open.info.split(/\s+/)[0] ?? "").toLowerCase();
  return { complete, pending: { lang, code } };
}

const LIST_ITEM_RE = /^ {0,3}(?:[-*+]|\d{1,9}[.)])(?:\s|$)/;
const TABLE_ROW_RE = /^\s*\|/;

/**
 * Splits markdown into independently renderable top-level blocks.
 * Joining the result with "\n\n" reproduces equivalent markdown.
 */
export function splitBlocks(markdown: string): string[] {
  const lines = markdown.split("\n");
  const blocks: string[] = [];
  let current: string[] = [];
  let fence: FenceOpen | null = null;
  let pendingBlank = false;

  const flush = () => {
    if (current.length) blocks.push(current.join("\n"));
    current = [];
  };

  const isListBlock = (block: string[]) => block.some((l) => LIST_ITEM_RE.test(l));

  for (const line of lines) {
    if (fence) {
      current.push(line);
      if (closesFence(line, fence)) fence = null;
      continue;
    }
    if (line.trim() === "") {
      if (current.length) pendingBlank = true;
      continue;
    }
    if (pendingBlank) {
      // Keep loose lists and their indented continuations in one block.
      const continuesList =
        isListBlock(current) && (LIST_ITEM_RE.test(line) || /^\s{2,}\S/.test(line));
      const continuesIndent = /^\s{4,}\S/.test(line) && !TABLE_ROW_RE.test(line);
      if (continuesList || continuesIndent) {
        current.push("");
      } else {
        flush();
      }
      pendingBlank = false;
    }
    const f = openFence(line);
    if (f) fence = f;
    current.push(line);
  }
  flush();
  return blocks;
}
