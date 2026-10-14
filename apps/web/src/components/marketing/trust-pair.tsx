import type { ReactNode } from "react";
import { CircleCheck } from "lucide-react";
import { cn } from "@/lib/cn";

/*
 * "Two trust cards" (kit product page §3.8). Left: a card of fact tiles, each
 * with a 64px circular seal, a small label, a 20px value and an indigo status
 * chip. Right: a feature row (56px indigo-50 icon tile + chip) over a key/value
 * list with indigo values. Only real, enforced facts go here (FACTS in
 * src/lib/site.ts); never certifications wuup does not hold.
 */

export interface TrustTile {
  /** Short text inside the seal, e.g. "100". */
  seal: ReactNode;
  /** Tiny caption under the seal text, e.g. "ROWS". */
  sealCaption?: ReactNode;
  label: ReactNode;
  value: ReactNode;
  chip: ReactNode;
}

export interface TrustListRow {
  icon: ReactNode;
  label: ReactNode;
  value: ReactNode;
}

export interface TrustCardBase {
  title: ReactNode;
  body: ReactNode;
}

export interface TrustPairProps {
  left: TrustCardBase & { tiles: TrustTile[] };
  right: TrustCardBase & {
    feature: { icon: ReactNode; title: ReactNode; sub: ReactNode; chip: ReactNode };
    rows: TrustListRow[];
  };
  className?: string;
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-indigo-200 bg-indigo-100 px-3 py-1 text-label font-medium text-indigo-800">
      <CircleCheck aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
      {children}
    </span>
  );
}

export function TrustPair({ left, right, className }: TrustPairProps) {
  return (
    <div className={cn("grid w-full gap-4 md:grid-cols-2", className)}>
      <article className="flex min-h-[28rem] flex-col gap-8 rounded-2xl border border-st bg-sf-white px-6 py-8 md:px-12 md:py-10">
        <div className="flex flex-col gap-3">
          <h3 className="text-heading-4 font-medium leading-[1.35] text-[#141414] md:text-heading-3">{left.title}</h3>
          <p className="max-w-md text-body leading-[1.6] text-tx-tertiary">{left.body}</p>
        </div>
        <ul className="mt-auto grid list-none gap-3 p-0 sm:grid-cols-2">
          {left.tiles.map((tile, i) => (
            <li
              key={i}
              className="flex flex-col items-center rounded-2xl border border-st-secondary bg-sf-secondary px-5 py-6 text-center"
            >
              <span
                aria-hidden="true"
                className="grid size-16 place-items-center rounded-full bg-[radial-gradient(circle,#fff_55%,var(--indigo-100)_56%,#fff_70%,var(--indigo-200)_71%,var(--indigo-100)_100%)] shadow-[0_0_0_1px_var(--indigo-200)]"
              >
                <span className="flex flex-col items-center leading-none">
                  <span className="font-display text-[17px] font-medium tracking-[-0.02em] text-indigo-800">{tile.seal}</span>
                  {tile.sealCaption ? (
                    <span className="mt-0.5 text-[7.5px] font-semibold uppercase tracking-[0.08em] text-indigo-700">
                      {tile.sealCaption}
                    </span>
                  ) : null}
                </span>
              </span>
              <span className="mt-4 text-label leading-4 text-tx-tertiary">{tile.label}</span>
              <span className="mt-1 text-heading-card font-medium leading-[1.3] tracking-[-0.015em] text-tx">{tile.value}</span>
              <span className="mt-4">
                <Chip>{tile.chip}</Chip>
              </span>
            </li>
          ))}
        </ul>
      </article>

      <article className="flex min-h-[28rem] flex-col gap-8 rounded-2xl border border-st bg-sf-white px-6 py-8 md:px-12 md:py-10">
        <div className="flex flex-col gap-3">
          <h3 className="text-heading-4 font-medium leading-[1.35] text-[#141414] md:text-heading-3">{right.title}</h3>
          <p className="max-w-md text-body leading-[1.6] text-tx-tertiary">{right.body}</p>
        </div>
        <div className="mt-auto">
          <div className="grid grid-cols-[3.5rem_1fr] items-center gap-x-4 gap-y-3 border-y border-st-secondary py-4 sm:grid-cols-[3.5rem_1fr_auto]">
            <span
              aria-hidden="true"
              className="grid size-14 place-items-center rounded-xl bg-indigo-100 text-indigo-800 [&_svg]:size-6 [&_svg]:stroke-[1.5]"
            >
              {right.feature.icon}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-body font-medium text-tx">{right.feature.title}</span>
              <span className="text-[13px] leading-[1.5] text-tx-tertiary">{right.feature.sub}</span>
            </span>
            <span className="col-span-2 sm:col-span-1">
              <Chip>{right.feature.chip}</Chip>
            </span>
          </div>
          <dl className="m-0">
            {right.rows.map((row, i) => (
              <div
                key={i}
                className="flex min-h-14 items-center justify-between gap-4 border-b border-st-secondary py-3.5 last:border-b-0"
              >
                <dt className="flex items-center gap-2.5 text-[15px] text-tx-secondary [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.5] [&_svg]:text-indigo-700">
                  {row.icon}
                  {row.label}
                </dt>
                <dd className="m-0 text-right text-caption font-medium text-indigo-800">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </article>
    </div>
  );
}
