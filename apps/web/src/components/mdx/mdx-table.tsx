import type { ComponentPropsWithoutRef } from "react";

/*
 * GFM tables. Articles and docs use the kit pricing-table look (white,
 * rounded 16, hairline rows, 12px uppercase header); legal pages restyle the
 * same markup as a bordered square table in prose.css (.prose--legal).
 * The wrapper scrolls horizontally on narrow screens.
 */
export function MdxTable(props: ComponentPropsWithoutRef<"table">) {
  return (
    <div className="prose-table" role="region" aria-label="Table" tabIndex={0}>
      <table {...props} />
    </div>
  );
}
