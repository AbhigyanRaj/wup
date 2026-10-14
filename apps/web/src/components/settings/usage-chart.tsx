"use client";

import { useMemo, useState } from "react";
import type { UsageDay } from "@/lib/types";

const W = 640;
const H = 160;
const PAD = { top: 12, right: 8, bottom: 24, left: 28 };

function niceMax(v: number) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

const fmtDay = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/** 30-day daily answers as thin rounded bars (single series, chart-1). */
export function UsageChart({ days }: { days: UsageDay[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const data = useMemo(() => days.slice(-30), [days]);
  const max = niceMax(Math.max(0, ...data.map((d) => d.messages)));
  const total = data.reduce((n, d) => n + d.messages, 0);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / Math.max(1, data.length);
  const barW = Math.max(3, Math.min(14, slot - 4));
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max];
  const h = hover !== null ? data[hover] : null;

  if (!data.length) return <p className="text-[14px] text-tx-tertiary">No activity yet.</p>;

  return (
    <figure className="relative m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label={`Answers per day over the last ${data.length} days: ${total} in total, peak ${Math.max(...data.map((d) => d.messages))} in a day.`}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#f0f0f0" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="#666">
              {t}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = PAD.left + slot * i + slot / 2;
          const bh = Math.max(d.messages > 0 ? 2 : 0, (d.messages / max) * innerH);
          const r = Math.min(4, barW / 2, bh);
          const x0 = cx - barW / 2;
          const y0 = PAD.top + innerH - bh;
          const active = hover === i;
          return (
            <g key={d.date}>
              {bh > 0 ? (
                <path
                  d={`M${x0},${PAD.top + innerH} V${y0 + r} Q${x0},${y0} ${x0 + r},${y0} H${x0 + barW - r} Q${x0 + barW},${y0} ${x0 + barW},${y0 + r} V${PAD.top + innerH} Z`}
                  fill="var(--chart-1)"
                  opacity={hover === null || active ? 1 : 0.35}
                  className="transition-opacity duration-150"
                />
              ) : null}
              {/* hit target wider than the bar */}
              <rect
                x={PAD.left + slot * i}
                y={PAD.top}
                width={slot}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
            </g>
          );
        })}
        {[0, Math.floor((data.length - 1) / 2), data.length - 1].map((i) => (
          <text
            key={i}
            x={PAD.left + slot * i + slot / 2}
            y={H - 6}
            textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
            fontSize={11}
            fill="#666"
          >
            {fmtDay(data[i].date)}
          </text>
        ))}
      </svg>
      {h && hover !== null ? (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-st bg-sf-white px-2.5 py-1.5 text-[12px] leading-4 shadow-card"
          style={{ left: `${((PAD.left + slot * hover + slot / 2) / W) * 100}%` }}
        >
          <p className="text-tx-tertiary">{fmtDay(h.date)}</p>
          <p className="font-medium tabular-nums text-tx">
            {h.messages} answer{h.messages === 1 ? "" : "s"}
            {h.research ? `, ${h.research} research` : ""}
          </p>
        </div>
      ) : null}
      <table className="sr-only">
        <caption>Answers per day</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Answers</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{d.date}</td>
              <td>{d.messages}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
