import type { ComponentPropsWithoutRef } from "react";

/*
 * Anchorable headings. rehype-slug sets the id; a "#" link appears on hover
 * (legal.md 4: 16px "#" in #666 to the left of the heading).
 */
function make(Tag: "h2" | "h3" | "h4") {
  function Heading({ id, children, ...rest }: ComponentPropsWithoutRef<"h2">) {
    return (
      <Tag id={id} {...rest}>
        {id ? (
          <a href={`#${id}`} className="heading-anchor" aria-hidden="true" tabIndex={-1}>
            #
          </a>
        ) : null}
        {children}
      </Tag>
    );
  }
  Heading.displayName = `Mdx${Tag.toUpperCase()}`;
  return Heading;
}

export const MdxH2 = make("h2");
export const MdxH3 = make("h3");
export const MdxH4 = make("h4");
