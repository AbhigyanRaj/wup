import type { ComponentPropsWithoutRef } from "react";
import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import { Callout } from "@/components/mdx/callout";
import { Figure } from "@/components/mdx/figure";
import { MdxH2, MdxH3, MdxH4 } from "@/components/mdx/heading";
import { MdxPre } from "@/components/mdx/mdx-code";
import { MdxTable } from "@/components/mdx/mdx-table";
import { QueryExample } from "@/components/mdx/query-example";
import { Steps } from "@/components/mdx/steps";
import { ToolCta } from "@/components/mdx/tool-cta";

/**
 * Global MDX components for guides, docs, changelog and legal pages.
 *
 * Element styling lives in src/styles/prose.css (imported by the article,
 * docs and legal layouts), scoped to `.prose`. Headings get ids from
 * rehype-slug; toc() in src/lib/mdx.ts produces the same ids.
 *
 * Components available in every .mdx file without an import:
 *   <Callout type="note|tip|warning|security" title?>, <Figure>, <QueryExample>,
 *   <ToolCta href title description>, <Steps> (wraps an ordered list).
 */

function Anchor({ href = "", children, ...rest }: ComponentPropsWithoutRef<"a">) {
  if (href.startsWith("/") || href.startsWith("#")) {
    return (
      <Link href={href} className="prose-link" {...rest}>
        {children}
      </Link>
    );
  }
  if (href.startsWith("mailto:")) {
    return (
      <a href={href} className="prose-link" {...rest}>
        {children}
      </a>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="prose-link prose-link--ext" {...rest}>
      {children}
    </a>
  );
}

function Img({ alt = "", src, ...props }: ComponentPropsWithoutRef<"img">) {
  // Markdown images have no intrinsic size; plain <img> keeps layout simple. Use <Figure> for next/image.
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt={alt} src={typeof src === "string" ? src : undefined} loading="lazy" decoding="async" className="mdx-img" {...props} />;
}

const components: MDXComponents = {
  // A stray "#" heading inside content must never become a second <h1>.
  h1: MdxH2,
  h2: MdxH2,
  h3: MdxH3,
  h4: MdxH4,
  a: Anchor,
  pre: MdxPre,
  table: MdxTable,
  img: Img,
  Callout,
  Figure,
  QueryExample,
  Steps,
  ToolCta,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
