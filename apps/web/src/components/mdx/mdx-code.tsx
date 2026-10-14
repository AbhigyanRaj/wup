import { isValidElement, type ReactElement, type ReactNode } from "react";
import { CodeBlock } from "@/components/ui/code-block";
import { highlightToHtml, languageLabel } from "./highlight";

/*
 * Fenced code in MDX. MDX renders ```lang fences as <pre><code class="language-lang">,
 * so this replaces <pre>: it highlights with shiki on the server and renders the
 * kit CodeBlock shell (grey strip with the language label and a copy button).
 */

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return "";
}

export async function MdxPre({ children }: { children?: ReactNode }) {
  const codeEl = (Array.isArray(children) ? children[0] : children) as ReactElement<{
    className?: string;
    children?: ReactNode;
  }>;
  const className = isValidElement(codeEl) ? (codeEl.props.className ?? "") : "";
  const lang = className.match(/language-([\w-]+)/)?.[1];
  const code = textOf(isValidElement(codeEl) ? codeEl.props.children : children).replace(/\n$/, "");
  return <MdxCode code={code} lang={lang} />;
}

export interface MdxCodeProps {
  code: string;
  lang?: string;
  /** Label in the strip. Defaults to the language name. */
  title?: string;
  className?: string;
}

export async function MdxCode({ code, lang, title, className }: MdxCodeProps) {
  const html = await highlightToHtml(code, lang);
  return (
    <CodeBlock title={title ?? languageLabel(lang)} code={code} className={className ?? "mdx-code"}>
      <span className="mdx-code__lines" dangerouslySetInnerHTML={{ __html: html }} />
    </CodeBlock>
  );
}
