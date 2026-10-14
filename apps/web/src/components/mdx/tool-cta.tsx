import Link from "next/link";
import type { ReactNode } from "react";

/*
 * Inline call to action for a free tool or connector page: a white hairline
 * card with a small gradient tile, title, one line and an arrow link.
 */
export interface ToolCtaProps {
  href: string;
  title: string;
  description?: string;
  cta?: string;
  children?: ReactNode;
}

export function ToolCta({ href, title, description, cta, children }: ToolCtaProps) {
  const isTool = href.startsWith("/tools/");
  return (
    <Link href={href} className="tool-cta group">
      <span className="tool-cta__tile" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          {isTool ? (
            <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" />
          ) : (
            <path d="M5 12h14M13 6l6 6-6 6" />
          )}
        </svg>
      </span>
      <span className="tool-cta__text">
        <span className="tool-cta__eyebrow">{isTool ? "Free tool" : "Try it in wuup"}</span>
        <span className="tool-cta__title">{title}</span>
        {description || children ? <span className="tool-cta__desc">{description ?? children}</span> : null}
      </span>
      <span className="tool-cta__go">
        {cta ?? (isTool ? "Open the tool" : "Learn more")}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
    </Link>
  );
}
