"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { SyntaxHighlighterProps } from "react-syntax-highlighter";
import { CodeBlock } from "@/components/ui/code-block";
import { cn } from "@/lib/cn";
import { KIT_CODE_THEME, languageLabel, loadHighlighter, resolveLanguage } from "@/lib/highlight";

/*
 * Public: syntax highlighted code inside the kit CodeBlock chrome.
 * First paint is plain text; Prism light (12 grammars) loads lazily and upgrades it.
 * Blocks taller than 480px collapse behind "Show more".
 */

const COLLAPSE_AT = 480;

const Pass = ({ children }: { children?: ReactNode }) => <>{children}</>;

let cached: ComponentType<SyntaxHighlighterProps> | null = null;

export function HighlightedCode({ language, value }: { language?: string | null; value: string }) {
  const code = typeof value === "string" ? value.replace(/\n$/, "") : "";
  const lang = resolveLanguage(language);
  const [Prism, setPrism] = useState<ComponentType<SyntaxHighlighterProps> | null>(() => cached);
  const [tall, setTall] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lang || Prism) return;
    let alive = true;
    loadHighlighter()
      .then((P) => {
        cached = P;
        if (alive) setPrism(() => P);
      })
      .catch(() => {
        /* stay on plain text */
      });
    return () => {
      alive = false;
    };
  }, [lang, Prism]);

  useLayoutEffect(() => {
    const pre = box.current?.querySelector("pre");
    if (!pre) return;
    const measure = () => setTall(pre.scrollHeight > COLLAPSE_AT + 40);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(pre);
    return () => ro.disconnect();
  }, [code]);

  const body =
    Prism && lang ? (
      <Prism language={lang} style={KIT_CODE_THEME} PreTag={Pass} CodeTag={Pass} useInlineStyles>
        {code}
      </Prism>
    ) : (
      code
    );

  const collapsed = tall && !expanded;

  return (
    <div ref={box} className="relative min-w-0">
      <CodeBlock
        title={languageLabel(language)}
        code={code}
        preClassName={cn(collapsed && "max-h-[480px] overflow-hidden!")}
      >
        {body}
      </CodeBlock>
      {tall ? (
        <div
          className={cn(
            "flex justify-center",
            collapsed
              ? "pointer-events-none absolute inset-x-px bottom-px h-28 items-end rounded-b-[11px] bg-linear-to-b from-[#fafafa]/0 via-[#fafafa]/90 to-[#fafafa] pb-3"
              : "mt-2",
          )}
        >
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((e) => !e)}
            className="pointer-events-auto inline-flex h-8 items-center gap-1.5 rounded-full border border-st bg-sf-white px-3.5 text-[13px] font-medium text-tx shadow-[0_1px_3px_#00000014] transition-colors hover:bg-sf-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
          >
            {expanded ? "Show less" : "Show more"}
            <ChevronDown aria-hidden="true" strokeWidth={1.5} className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default HighlightedCode;
