import { MdxCode } from "./mdx-code";

/*
 * A worked example: the plain-English question, the query wuup (or you) would
 * run, and an example result table. Rendered as one white hairline card.
 */
export interface QueryExampleProps {
  question: string;
  /** Collection the query runs against, shown in the code strip. */
  collection?: string;
  /** The query, e.g. db.orders.aggregate([...]). */
  code?: string;
  /** Alias of `code`. */
  pipeline?: string;
  lang?: string;
  columns?: string[];
  rows?: Array<Array<string | number | boolean | null>>;
  /** Caption under the result. Defaults to "Example result on sample data". */
  note?: string;
}

const fmt = (v: string | number | boolean | null) =>
  v === null ? "null" : typeof v === "number" ? v.toLocaleString("en-US") : String(v);

export function QueryExample({ question, collection, code, pipeline, lang = "mongosh", columns, rows, note }: QueryExampleProps) {
  const query = (code ?? pipeline ?? "").trim();
  return (
    <figure className="query-example">
      <figcaption className="query-example__q">
        <span className="query-example__label">Question</span>
        <span className="query-example__question">{question}</span>
      </figcaption>
      {query ? (
        <MdxCode code={query} lang={lang} title={collection ? `Query on ${collection}` : "Query"} className="query-example__code" />
      ) : null}
      {columns?.length && rows?.length ? (
        <div className="query-example__result">
          <span className="query-example__label">Result</span>
          <div className="prose-table query-example__table" role="region" aria-label="Example result" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c} scope="col">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((v, j) => (
                      <td key={j} className={typeof v === "number" ? "is-num" : undefined}>
                        {fmt(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="query-example__note">{note ?? "Example result on sample data."}</p>
        </div>
      ) : null}
    </figure>
  );
}
