import { Workflow } from "lucide-react";

/** An unterminated code fence while streaming: never rendered as a real diagram yet. */
export function PendingBlock({ lang, code }: { lang: string; code: string }) {
  if (lang === "mermaid") {
    return (
      <div
        role="status"
        className="my-4 flex h-[140px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/60 text-[14px] text-indigo-800"
      >
        <Workflow className="size-5 animate-pulse motion-reduce:animate-none" strokeWidth={1.5} aria-hidden="true" />
        <span>Drawing diagram</span>
      </div>
    );
  }
  return (
    <div className="code my-4">
      {lang ? (
        <div className="border-b border-st bg-sf-tertiary font-sans text-[13px]">
          <span className="code__title block">{lang}</span>
        </div>
      ) : null}
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}
