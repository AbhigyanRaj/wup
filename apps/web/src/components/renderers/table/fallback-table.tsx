/*
 * Minimal, hook-free table used by the error boundary. Deliberately simple so it
 * cannot fail where the full DataTable did.
 */

function text(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

export function FallbackTable({
  rows,
  columns,
  limit = 200,
}: {
  rows: ReadonlyArray<Record<string, unknown>>;
  columns?: readonly string[];
  limit?: number;
}) {
  const cols = columns?.length
    ? columns
    : [...new Set(rows.flatMap((r) => (r && typeof r === "object" ? Object.keys(r) : [])))];
  const shown = rows.slice(0, limit);
  return (
    <div className="max-h-[420px] overflow-auto rounded-xl border border-st-secondary">
      <table className="w-full border-separate border-spacing-0 text-left text-[14px] leading-5 tabular-nums">
        <thead>
          <tr>
            {cols.map((c) => (
              <th
                key={c}
                scope="col"
                className="sticky top-0 whitespace-nowrap border-b border-st-secondary bg-sf-white px-4 py-2.5 text-[12px] font-medium uppercase tracking-[0.08em] text-tx-tertiary"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr key={i}>
              {cols.map((c) => (
                <td key={c} className="border-t border-st-secondary px-4 py-2.5 text-tx first:border-l-0">
                  {text(r?.[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > limit ? (
        <p className="border-t border-st-secondary px-4 py-2 text-[13px] text-tx-tertiary">
          Showing {limit} of {rows.length} rows
        </p>
      ) : null}
    </div>
  );
}
