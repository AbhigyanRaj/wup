import { ButtonLink } from "@/components/ui/button";
import { AssistantHead, BarChart, Cite, MockCard, MiniTable, QueriesRow, UserBubble } from "./answer-mock";

/*
 * Kit "statement block" (home.md §6): a 30% text card and a 70% media card,
 * with a faint glyph field behind (here: MongoDB operators instead of scripts).
 * The media is a coded answer mock on a grainy blue mat, annotated to show
 * which parts come from rows and which from the model.
 */

const GLYPHS = "$match $group $sum $sort { } [ ] $avg $project $limit $unwind $count $lookup $dateToString $gte $in : , ";

function GlyphField() {
  const line = GLYPHS.repeat(6);
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-[-6vw] inset-y-[-48px] select-none overflow-hidden font-mono text-[11px] leading-[22px] tracking-[0.12em] text-indigo-600/[0.07] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_50%,transparent_35%,#000_75%)]"
    >
      {Array.from({ length: 30 }, (_, i) => (
        <p key={i} className="whitespace-nowrap" style={{ transform: `translateX(-${(i * 37) % 160}px)` }}>
          {line}
        </p>
      ))}
    </div>
  );
}

function Annotation({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-medium text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.3)] backdrop-blur-md ${className ?? ""}`}
    >
      <span className="size-1.5 rounded-full bg-sky-300" />
      {children}
    </span>
  );
}

export function StatementSplit() {
  return (
    <section className="container relative" aria-labelledby="trust-title">
      <GlyphField />
      <div className="relative grid gap-2 lg:grid-cols-[minmax(0,3fr)_minmax(0,7fr)]">
        <div className="flex flex-col rounded-xl border border-st-secondary bg-sf-white p-8">
          <h2 id="trust-title" className="h-section">
            {"Charts you\ncan trust"}
          </h2>
          <p className="mt-6 text-[16px] leading-[1.65] text-tx-tertiary">
            Every chart and table is built from the rows your query returned. The model writes the words, not the numbers.
          </p>
          <p className="mt-4 text-[16px] leading-[1.65] text-tx-tertiary">
            Each claim carries a citation, and the queries sit one click away, so anyone on your team can check the work.
          </p>
          <div className="mt-10 lg:mt-auto lg:pt-16">
            <ButtonLink href="/features" variant="ink">
              See how answers work
            </ButtonLink>
          </div>
        </div>

        <div
          className="relative overflow-hidden rounded-xl border border-st-secondary p-4 md:p-10"
          style={{
            background:
              "radial-gradient(90% 80% at 15% 0%, #c4b5fd 0%, transparent 60%), radial-gradient(80% 90% at 100% 100%, #7dd3fc 0%, transparent 55%), linear-gradient(160deg, #3b63d9 0%, #2563eb 45%, #5b8def 100%)",
          }}
        >
          <div className="pointer-events-none absolute inset-0 bg-[image:var(--noise-url)] bg-[length:384px] opacity-50 mix-blend-soft-light" aria-hidden="true" />
          <div className="relative mx-auto flex max-w-[640px] flex-col gap-3 rounded-2xl bg-sf-white p-4 shadow-[0_0_0_8px_rgba(255,255,255,0.28),0_30px_60px_-20px_rgba(11,16,38,0.5)] md:p-6">
            <UserBubble>How did repeat buyers change revenue this half?</UserBubble>
            <AssistantHead meta="from 2 queries on orders" />
            <p className="relative text-[13.5px] leading-[1.6] text-tx-secondary">
              Repeat buyers brought in <b className="font-medium text-tx">58%</b> of revenue from January to June, up from 41% <Cite n={1} />.
              The jump starts in March <Cite n={2} />.
            </p>
            <div className="relative grid gap-2.5 sm:grid-cols-[1.4fr_1fr]">
              <MockCard title="Repeat share of revenue" meta="orders · H1 2026">
                <BarChart
                  height={118}
                  highlight={2}
                  format={(v) => `${v.toFixed(0)}%`}
                  data={[
                    { label: "Jan", value: 41 },
                    { label: "Feb", value: 44 },
                    { label: "Mar", value: 53 },
                    { label: "Apr", value: 55 },
                    { label: "May", value: 57 },
                    { label: "Jun", value: 58 },
                  ]}
                />
              </MockCard>
              <MockCard title="Rows returned" meta="6 rows">
                <MiniTable
                  columns={["Month", "Repeat"]}
                  numeric={[1]}
                  highlightRow={2}
                  rows={[
                    ["Jan", "41%"],
                    ["Feb", "44%"],
                    ["Mar", "53%"],
                    ["Apr", "55%"],
                    ["May", "57%"],
                  ]}
                />
              </MockCard>
            </div>
            <QueriesRow count={2} detail="orders.aggregate([$match, $group, $project])" />
          </div>
          <div className="relative mt-5 flex flex-wrap justify-center gap-2 md:mt-6">
            <Annotation>Words: written by the model</Annotation>
            <Annotation>Numbers: straight from your rows</Annotation>
          </div>
        </div>
      </div>
    </section>
  );
}
