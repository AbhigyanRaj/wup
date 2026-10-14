import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
 * Article callout (kit blog-post 2.3 "Blockquote / callout"): a 3px left rule,
 * 24px indent, upright display face at 20px / 1.65. A small sans label names
 * the kind. Warning and security notes tint the rule.
 */

export type CalloutType = "note" | "tip" | "warning" | "security";

const LABEL: Record<CalloutType, string> = {
  note: "Note",
  tip: "Tip",
  warning: "Warning",
  security: "Security",
};

export interface CalloutProps {
  type?: CalloutType;
  title?: string;
  children?: ReactNode;
}

export function Callout({ type = "note", title, children }: CalloutProps) {
  const role = type === "warning" ? "note" : undefined;
  return (
    <aside className={cn("callout", `callout--${type}`)} role={role} aria-label={title ?? LABEL[type]}>
      <p className="callout__label">{title ?? LABEL[type]}</p>
      <div className="callout__body">{children}</div>
    </aside>
  );
}
