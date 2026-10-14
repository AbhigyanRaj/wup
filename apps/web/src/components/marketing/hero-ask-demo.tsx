"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { ArrowUp, Check, Code2, Copy, CornerDownRight, Link2, Lock, Quote, ThumbsDown, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/cn";
import s from "./hero-ask.module.css";

/*
 * The hero's live ask box. Server HTML renders the FINAL state of the first
 * example (question, answer, chart), so nothing shifts and the H1 stays the
 * LCP. After hydration a single clock (t, in ms) drives each example: type
 * the question, press send, query, stream the answer, hold, next tab. Hover,
 * focus, a hidden tab or an off-screen hero pause the clock. Reduced motion
 * never starts it, so every tab shows its final state.
 */

type Seg = string | { cite: number };

interface Example {
  id: string;
  label: string;
  logo: string;
  scope: string;
  question: string;
  working: string;
  done: string;
  answer: Seg[];
  stat: string;
  followUps: [string, string];
  visual: "bar" | "line" | "quote";
}

const EXAMPLES: Example[] = [
  {
    id: "mongodb",
    label: "MongoDB",
    logo: "/logos/mongodb.svg",
    scope: "shop-prod · orders",
    question: "Which products drove revenue last quarter?",
    working: "Querying orders · 2 queries",
    done: "Queried orders · 2 queries · 1.4s",
    answer: [
      "Three products drove 78% of Q3 revenue.",
      " Desk Pro led with $182k",
      { cite: 1 },
      ", up 24% on Q2, followed by Arc Lamp at $141k and Ergo Chair at $96k",
      { cite: 2 },
      ". Dock and Stand together added under $120k.",
    ],
    stat: "2 queries used",
    followUps: ["Break it down by region", "Compare with Q2"],
    visual: "bar",
  },
  {
    id: "sheets",
    label: "Google Sheets",
    logo: "/logos/google-sheets.svg",
    scope: "Pipeline 2026 · Deals",
    question: "How did pipeline value change week over week?",
    working: "Reading Pipeline 2026 · 2 queries",
    done: "Read Pipeline 2026 · 2 queries · 1.1s",
    answer: [
      "Pipeline value rose from $1.20M to $1.90M over eight weeks",
      { cite: 1 },
      ", growing in five of seven weeks. The biggest jump was week 6 (+18%), when two enterprise deals moved to Proposal",
      { cite: 2 },
      ". Week 7 dipped 4% as one deal slipped.",
    ],
    stat: "2 queries used",
    followUps: ["Which deal slipped in week 7?", "Show pipeline by rep"],
    visual: "line",
  },
  {
    id: "pdf",
    label: "PDFs",
    logo: "/logos/pdf.svg",
    scope: "Contracts · Vendor MSA.pdf",
    question: "What does the contract say about termination?",
    working: "Searching Vendor MSA.pdf · 3 passages",
    done: "Searched Vendor MSA.pdf · 3 passages · 0.9s",
    answer: [
      "Either party can end the agreement for convenience with 60 days' written notice",
      { cite: 1 },
      ". A material breach allows termination for cause after a 30-day cure period",
      { cite: 2 },
      ", and prepaid fees for unused months are refunded pro rata",
      { cite: 1 },
      ".",
    ],
    stat: "3 passages cited",
    followUps: ["List every notice deadline", "What about auto-renewal?"],
    visual: "quote",
  },
];

/* ---------- Timeline ---------- */

const TYPE_START = 450;
const PER_CHAR = 34;
const QUERY_MS = 1250;
const PER_TOKEN = 42;
const HOLD_MS = 3300;
const MIN_CYCLE = 9000;

function tokensOf(ex: Example): Seg[] {
  const out: Seg[] = [];
  for (const seg of ex.answer) {
    if (typeof seg !== "string") out.push(seg);
    else for (const w of seg.match(/\s*\S+/g) ?? []) out.push(w);
  }
  return out;
}

const TOKENS = EXAMPLES.map(tokensOf);

function timeline(i: number) {
  const typed = TYPE_START + EXAMPLES[i].question.length * PER_CHAR;
  const press = typed + 380;
  const sent = press + 140;
  const answer = sent + QUERY_MS;
  const done = answer + TOKENS[i].length * PER_TOKEN;
  return { typed, press, sent, answer, done, cycle: Math.max(MIN_CYCLE, done + HOLD_MS) };
}

const TIMES = EXAMPLES.map((_, i) => timeline(i));
/** A clock value at which example i is fully settled. */
const settled = (i: number) => TIMES[i].done + 400;

/* ---------- Reduced motion ---------- */

const MOTION_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeMotion(cb: () => void) {
  const mq = window.matchMedia(MOTION_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const motionOk = () => !window.matchMedia(MOTION_QUERY).matches;

/* ---------- Component ---------- */

export function HeroAskDemo() {
  const [state, setState] = useState({ tab: 0, t: settled(0) });
  const pause = useRef({ hover: false, focus: false, hidden: false, offscreen: false });
  const rootRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const base = useId().replace(/:/g, "");

  // Start the clock only when motion is welcome (server: never).
  const animated = useSyncExternalStore(subscribeMotion, motionOk, () => false);

  useEffect(() => {
    if (!animated) return;
    const p = pause.current;
    const onVis = () => (p.hidden = document.hidden);
    onVis();
    document.addEventListener("visibilitychange", onVis);
    const io = new IntersectionObserver(([e]) => (p.offscreen = !e.isIntersecting));
    if (rootRef.current) io.observe(rootRef.current);

    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(now - last, 100);
      last = now;
      if (p.hover || p.focus || p.hidden || p.offscreen) return;
      setState((st) => {
        const t = st.t + dt;
        if (t < TIMES[st.tab].cycle) return { tab: st.tab, t };
        return { tab: (st.tab + 1) % EXAMPLES.length, t: 0 };
      });
    }, 32);
    return () => {
      window.clearInterval(id);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [animated]);

  function select(i: number) {
    setState({ tab: i, t: animated ? 0 : settled(i) });
  }

  function onKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const n = EXAMPLES.length;
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (i + 1) % n;
    if (e.key === "ArrowLeft") next = (i - 1 + n) % n;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = n - 1;
    if (next === null) return;
    e.preventDefault();
    select(next);
    tabRefs.current[next]?.focus();
  }

  const tab = state.tab;
  const t = animated ? state.t : settled(tab);
  const ex = EXAMPLES[tab];
  const tm = TIMES[tab];
  const tokens = TOKENS[tab];

  const chars = Math.max(0, Math.min(ex.question.length, Math.floor((t - TYPE_START) / PER_CHAR)));
  const composing = t < tm.sent;
  const pressed = t >= tm.press && t < tm.press + 200;
  const cardShown = t >= tm.sent;
  const answering = t >= tm.answer;
  const shownTokens = answering ? Math.floor((t - tm.answer) / PER_TOKEN) + 1 : 0;
  const visualOn = t >= tm.answer + 180;
  const finished = t >= tm.done;

  return (
    <div
      ref={rootRef}
      className="flex w-full flex-col items-center"
      onPointerEnter={() => (pause.current.hover = true)}
      onPointerLeave={() => (pause.current.hover = false)}
      onFocus={() => (pause.current.focus = true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) pause.current.focus = false;
      }}
    >
      {/* Source tabs */}
      <div role="tablist" aria-label="Example data source" className="flex flex-wrap items-center justify-center gap-1.5">
        {EXAMPLES.map((e, i) => {
          const active = i === tab;
          return (
            <button
              key={e.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              id={`${base}-tab-${e.id}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`${base}-panel`}
              tabIndex={active ? 0 : -1}
              onClick={() => select(i)}
              onKeyDown={(ev) => onKey(ev, i)}
              className={cn(
                "chip inline-flex items-center gap-2 !px-3.5 max-md:!px-3 max-md:!text-[13px]",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400",
                active ? "is-active !text-tx shadow-[0_1px_2px_rgba(16,24,40,0.05)]" : "!text-tx-tertiary hover:!text-tx",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- 24px monochrome SVG */}
              <img
                src={e.logo}
                alt=""
                width={16}
                height={16}
                className={cn("size-4 transition-opacity", active ? "opacity-100" : "opacity-70")}
              />
              {e.label}
            </button>
          );
        })}
      </div>

      <div
        id={`${base}-panel`}
        role="tabpanel"
        aria-labelledby={`${base}-tab-${ex.id}`}
        className="mt-4 flex w-full flex-col items-center md:mt-5"
      >
        {/* Screen readers get the finished example, not the typing. */}
        <p className="sr-only">
          Example question: {ex.question} Answer: {ex.answer.map((seg) => (typeof seg === "string" ? seg : ` [${seg.cite}]`)).join("")}
        </p>

        <div aria-hidden="true" className="flex w-full flex-col items-center">
          {/* Ask box (kit .prompt) */}
          <div className={cn("prompt !p-2 text-left md:!p-2.5", s.prompt)}>
            <div className="prompt__inner !px-4 !pb-3 !pt-3.5 md:!px-5 md:!pt-4">
              <p className="h-12 text-[16px] leading-6 tracking-[-0.005em] text-tx md:h-7 md:text-[18px] md:leading-7">
                {chars === 0 && composing ? (
                  <span className="text-tx-muted">
                    <span className={s.caret} />
                    <span className="ml-0.5">Ask anything about your data</span>
                  </span>
                ) : (
                  <>
                    {ex.question.slice(0, chars)}
                    {composing ? <span className={s.caret} /> : null}
                  </>
                )}
              </p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="prompt__tag min-w-0 !gap-1.5 !rounded-full !px-2.5 !py-1 text-[12px]">
                    {/* eslint-disable-next-line @next/next/no-img-element -- 24px monochrome SVG */}
                    <img src={ex.logo} alt="" width={12} height={12} className="size-3 shrink-0" />
                    <span className="truncate">{ex.scope}</span>
                  </span>
                  <span className="prompt__tag !hidden !gap-1 !rounded-full !px-2.5 !py-1 text-[12px] sm:!inline-flex">
                    <Lock className="size-3" strokeWidth={2} />
                    Read-only
                  </span>
                </div>
                <span
                  data-pressed={pressed}
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-full text-white",
                    s.send,
                    composing && chars === 0 ? "bg-grey-300" : "bg-ink shadow-btn-ink",
                  )}
                >
                  <ArrowUp className="size-4" strokeWidth={2.2} />
                </span>
              </div>
            </div>
          </div>

          {/* Answer card: fixed height so nothing below it moves. */}
          <div className="mt-3 h-[462px] w-[min(760px,100%)] sm:h-[430px] md:mt-4 md:h-[322px]">
            <div
              data-shown={cardShown}
              className={cn(
                "flex h-full flex-col overflow-hidden rounded-[20px] border border-st bg-sf-white text-left shadow-[0_1px_2px_rgba(16,24,40,0.04),0_18px_40px_-22px_rgba(37,56,120,0.18)]",
                s.card,
              )}
            >
              {/* Status */}
              <div className="flex items-center justify-between gap-3 border-b border-st-secondary px-4 py-2.5 md:px-5">
                <div className="flex min-w-0 items-center gap-2 text-[12.5px] text-tx-tertiary md:text-[13px]">
                  {answering ? (
                    <span className={cn("grid size-4 shrink-0 place-items-center rounded-full bg-green-100 text-green-700", s.check)}>
                      <Check className="size-2.5" strokeWidth={3} />
                    </span>
                  ) : (
                    <span className={cn("shrink-0", s.spinner)} />
                  )}
                  <span className="truncate">{answering ? ex.done : ex.working}</span>
                </div>
                <span data-on={finished} className={cn("hidden shrink-0 items-center gap-3 text-tx-muted sm:inline-flex", s.fade)}>
                  <Copy className="size-3.5" strokeWidth={1.8} />
                  <ThumbsUp className="size-3.5" strokeWidth={1.8} />
                  <ThumbsDown className="size-3.5" strokeWidth={1.8} />
                </span>
              </div>

              {/* Body */}
              <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr] gap-4 px-4 pb-4 pt-3.5 md:grid-cols-[1fr_288px] md:grid-rows-1 md:gap-6 md:px-5 md:pt-4">
                <div className="flex min-w-0 flex-col">
                  {answering ? (
                    <p className="text-[13.5px] leading-[22px] text-tx-secondary md:text-[14px] md:leading-[23px]">
                      {tokens.map((tok, i) =>
                        typeof tok === "string" ? (
                          <span key={i} data-on={i < shownTokens} className={s.tok}>
                            {tok}
                          </span>
                        ) : (
                          <span key={i} data-on={i < shownTokens} className={cn("ml-0.5 align-[1px]", s.tok)}>
                            <span className="inline-grid h-[17px] min-w-[17px] place-items-center rounded-[5px] bg-indigo-50 px-1 font-mono text-[10.5px] font-medium leading-none text-indigo-800 ring-1 ring-inset ring-indigo-100">
                              {tok.cite}
                            </span>
                          </span>
                        ),
                      )}
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2.5 pt-1.5">
                      <span className={cn("h-3 w-[92%]", s.shimmer)} />
                      <span className={cn("h-3 w-[78%]", s.shimmer)} />
                      <span className={cn("h-3 w-[64%]", s.shimmer)} />
                    </div>
                  )}
                  <div data-on={finished} className={cn("mt-auto hidden flex-col items-start gap-1.5 pt-3 md:flex", s.fade)}>
                    <span className="text-[11.5px] text-tx-muted">Suggested follow-ups</span>
                    <div className="flex flex-wrap gap-1.5">
                      {ex.followUps.map((f) => (
                        <span
                          key={f}
                          className="inline-flex items-center gap-1.5 rounded-full bg-sf-secondary px-2.5 py-1 text-[12.5px] leading-4 text-tx-secondary"
                        >
                          <CornerDownRight className="size-3 text-tx-muted" strokeWidth={2} />
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div data-on={answering} className={cn("min-h-0", s.fade)}>
                  {ex.visual === "bar" ? <BarChart on={visualOn} /> : null}
                  {ex.visual === "line" ? <LineChart on={visualOn} /> : null}
                  {ex.visual === "quote" ? <Snippets on={visualOn} /> : null}
                </div>
              </div>

              {/* Footer chips */}
              <div data-on={finished} className={cn("flex flex-wrap items-center gap-1 border-t sm:gap-1.5 border-st-secondary px-4 py-2.5 md:px-5", s.fade)}>
                <FooterChip>
                  {ex.visual === "quote" ? <Quote className="size-3" strokeWidth={2} /> : <Code2 className="size-3" strokeWidth={2} />}
                  {ex.stat}
                </FooterChip>
                <FooterChip>
                  <Link2 className="size-3" strokeWidth={2} />
                  Sources
                  <span className="rounded-full bg-indigo-50 px-1.5 font-mono text-[10px] leading-4 text-indigo-800 max-sm:hidden">2</span>
                </FooterChip>
                <FooterChip>
                  {/* eslint-disable-next-line @next/next/no-img-element -- 24px monochrome SVG */}
                  <img src="/logos/gemini.svg" alt="" width={12} height={12} className="size-3" />
                  <span>
                    <span className="max-sm:hidden">Model: </span>Gemini
                  </span>
                </FooterChip>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FooterChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-st bg-sf-white px-2 py-1 text-[11.5px] leading-4 text-tx-tertiary sm:px-2.5 sm:text-[12px]">
      {children}
    </span>
  );
}

/* ---------- Visuals (fixed data, kit chart palette) ---------- */

const PANEL = "flex flex-col md:h-full rounded-xl border border-st-secondary bg-[#fafbfd] px-3.5 pb-2.5 pt-3";

function PanelHead({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="truncate text-[12px] font-medium text-tx">{title}</span>
      <span className="shrink-0 text-[11px] text-tx-muted">{meta}</span>
    </div>
  );
}

const PRODUCTS = [
  { name: "Desk Pro", v: 182 },
  { name: "Arc Lamp", v: 141 },
  { name: "Ergo Chair", v: 96 },
  { name: "Dock", v: 74 },
  { name: "Stand", v: 41 },
];

function BarChart({ on }: { on: boolean }) {
  const W = 260;
  const H = 132;
  const top = 18;
  const max = 200;
  const slot = W / PRODUCTS.length;
  const bw = 22;
  return (
    <div className={PANEL}>
      <PanelHead title="Revenue by product, Q3" meta="USD" />
      <svg data-on={on} viewBox={`0 0 ${W} ${H + 18}`} className={cn("mt-2 h-auto max-h-[150px] w-full flex-1 md:max-h-none", s.chart)} role="presentation">
        {[0, 0.5, 1].map((g) => (
          <line key={g} x1={0} x2={W} y1={top + (H - top) * g} y2={top + (H - top) * g} stroke="#edeff3" strokeWidth={1} />
        ))}
        {PRODUCTS.map((p, i) => {
          const h = ((H - top) * p.v) / max;
          const x = slot * i + (slot - bw) / 2;
          const y = H - h;
          const lead = i < 3;
          return (
            <g key={p.name} style={{ ["--i" as string]: i }}>
              <path
                className={s.bar}
                d={`M${x},${H} V${y + 4} Q${x},${y} ${x + 4},${y} H${x + bw - 4} Q${x + bw},${y} ${x + bw},${y + 4} V${H} Z`}
                fill={lead ? "var(--chart-1)" : "#c7d7fb"}
              />
              {lead ? (
                <text className={s.barLabel} x={x + bw / 2} y={y - 5} textAnchor="middle" fontSize={10.5} fontWeight={525} fill="#3d3d3d">
                  ${p.v}k
                </text>
              ) : null}
              <text x={slot * i + slot / 2} y={H + 14} textAnchor="middle" fontSize={10.5} fill="#8a8a8a">
                {p.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const WEEKS = [1.2, 1.26, 1.31, 1.28, 1.42, 1.68, 1.61, 1.9];

function LineChart({ on }: { on: boolean }) {
  const W = 260;
  const H = 128;
  const top = 22;
  const lo = 1.1;
  const hi = 2.0;
  const pts = WEEKS.map((v, i) => [8 + (i * (W - 24)) / (WEEKS.length - 1), top + (H - top) * (1 - (v - lo) / (hi - lo))] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${d} L${pts[pts.length - 1][0].toFixed(1)},${H} L${pts[0][0].toFixed(1)},${H} Z`;
  const [ex, ey] = pts[pts.length - 1];
  const [jx, jy] = pts[5];
  const gid = useId().replace(/:/g, "");
  return (
    <div className={PANEL}>
      <PanelHead title="Pipeline value, weekly" meta="USD M" />
      <svg data-on={on} viewBox={`0 0 ${W} ${H + 18}`} className={cn("mt-2 h-auto max-h-[150px] w-full flex-1 md:max-h-none", s.chart)} role="presentation">
        <defs>
          <linearGradient id={`${gid}-a`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#2563eb" stopOpacity="0.16" />
            <stop offset="1" stopColor="#2563eb" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((g) => (
          <line key={g} x1={0} x2={W} y1={top + (H - top) * g} y2={top + (H - top) * g} stroke="#edeff3" strokeWidth={1} />
        ))}
        <path className={s.area} d={area} fill={`url(#${gid}-a)`} />
        <path className={s.line} d={d} pathLength={1} fill="none" stroke="var(--chart-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <g className={s.marker}>
          <circle cx={jx} cy={jy} r={3.5} fill="#fff" stroke="var(--chart-1)" strokeWidth={1.5} />
          <text x={jx} y={jy - 9} textAnchor="middle" fontSize={10} fontWeight={525} fill="#3d3d3d">
            +18%
          </text>
          <circle cx={ex} cy={ey} r={4.5} fill="var(--chart-1)" stroke="#fff" strokeWidth={2} />
          <text x={ex - 2} y={ey - 10} textAnchor="end" fontSize={10.5} fontWeight={525} fill="#3d3d3d">
            $1.90M
          </text>
        </g>
        {pts.map(([x], i) => (
          <text key={i} x={x} y={H + 14} textAnchor="middle" fontSize={10.5} fill="#8a8a8a">
            W{i + 1}
          </text>
        ))}
      </svg>
    </div>
  );
}

function Snippets({ on }: { on: boolean }) {
  return (
    <div data-on={on} className={cn("flex h-full flex-col gap-2", s.chart)}>
      <figure className={cn("rounded-xl border border-st-secondary bg-[#fafbfd] px-3.5 py-3", s.quote)} style={{ ["--i" as string]: 0 }}>
        <figcaption className="flex items-center justify-between gap-2 text-[11px] text-tx-muted">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="grid h-[15px] min-w-[15px] place-items-center rounded-[4px] bg-indigo-50 font-mono text-[9.5px] text-indigo-800 ring-1 ring-inset ring-indigo-100">
              1
            </span>
            <span className="truncate">Vendor MSA.pdf</span>
          </span>
          <span className="shrink-0 font-mono">p. 14 · §12.2</span>
        </figcaption>
        <blockquote className="mt-2 border-l-2 border-indigo-200 pl-2.5 text-[12.5px] leading-[19px] text-tx-secondary">
          &ldquo;Either party may terminate this Agreement for convenience upon{" "}
          <mark className="rounded-[3px] bg-indigo-100/70 px-0.5 text-indigo-900">sixty (60) days&rsquo; written notice</mark> to the other
          party.&rdquo;
        </blockquote>
      </figure>
      <figure className={cn("rounded-xl border border-st-secondary bg-[#fafbfd] px-3.5 py-3 max-md:hidden", s.quote)} style={{ ["--i" as string]: 1 }}>
        <figcaption className="flex items-center justify-between gap-2 text-[11px] text-tx-muted">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="grid h-[15px] min-w-[15px] place-items-center rounded-[4px] bg-indigo-50 font-mono text-[9.5px] text-indigo-800 ring-1 ring-inset ring-indigo-100">
              2
            </span>
            <span className="truncate">Vendor MSA.pdf</span>
          </span>
          <span className="shrink-0 font-mono">p. 15 · §12.3</span>
        </figcaption>
        <blockquote className="mt-2 border-l-2 border-indigo-200 pl-2.5 text-[12.5px] leading-[19px] text-tx-secondary">
          &ldquo;&hellip;if the breach remains uncured <mark className="rounded-[3px] bg-indigo-100/70 px-0.5 text-indigo-900">thirty (30) days</mark> after notice.&rdquo;
        </blockquote>
      </figure>
    </div>
  );
}
