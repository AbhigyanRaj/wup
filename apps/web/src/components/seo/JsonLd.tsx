import type { Graph, Thing, WithContext } from "schema-dts";

type JsonLdData = Graph | WithContext<Thing & object>;

/**
 * Renders structured data as a native script tag (not next/script).
 * "<" is escaped so a string in the payload cannot close the tag.
 */
export function JsonLd({ data }: { data: JsonLdData }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export default JsonLd;
