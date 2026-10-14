/* Number formatting shared by chart axes, tooltips, legends and tables. */

export interface Affix {
  prefix: string;
  suffix: string;
}

export const NO_AFFIX: Affix = { prefix: "", suffix: "" };

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 1 });

function wrap(n: number, body: string, affix: Affix): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}${affix.prefix}${body}${affix.suffix}`;
}

/** Axis ticks: 0 / 1.2K / 3M with the series' currency or unit. */
export function formatCompact(n: number, affix: Affix = NO_AFFIX): string {
  return wrap(n, compact.format(Math.abs(n)), affix);
}

/** Tooltips and legends: 1,234.5 with the series' currency or unit. */
export function formatFull(n: number, affix: Affix = NO_AFFIX): string {
  return wrap(n, full.format(Math.abs(n)), affix);
}

export function formatPercent(share: number): string {
  return percent.format(share);
}
