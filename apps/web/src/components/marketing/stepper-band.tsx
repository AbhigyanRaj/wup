"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
 * Showcase band with a process stepper (kit product page §3.2). A soft
 * periwinkle-to-sky band (the kit's static fallback for its WebGL gradient,
 * plus grain) holds a row of step pills joined by white connectors, then a
 * framed product mock. Steps auto-advance every few seconds while the band is
 * on screen; hovering or focusing the band pauses it, and with reduced motion
 * it never advances on its own. Every panel is in the server HTML; inactive
 * ones are faded out and made inert. Mobile shows only the active pill.
 */

export interface StepperStep {
  title: string;
  body: string;
  icon: ReactNode;
  /** The framed mock for this step (a server-rendered node). */
  panel: ReactNode;
}

const ADVANCE_MS = 4800;

export function StepperBand({ steps, label, className }: { steps: StepperStep[]; label: string; className?: string }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const rootRef = useRef<HTMLElement | null>(null);
  const pillRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const first = useRef(true);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || paused || !visible) return;
    const t = window.setTimeout(() => setActive((a) => (a + 1) % steps.length), ADVANCE_MS);
    return () => window.clearTimeout(t);
  }, [active, paused, visible, steps.length]);

  // The kit's "launch pill jump" on the newly active pill (WAAPI: no global keyframes needed).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    pillRefs.current[active]?.animate(
      [{ transform: "translateY(0)" }, { transform: "translateY(-6px)" }, { transform: "translateY(0)" }],
      { duration: 500, easing: "cubic-bezier(.34,1.56,.64,1)" },
    );
  }, [active]);

  return (
    <section
      ref={rootRef}
      aria-label={label}
      className={cn("relative isolate overflow-hidden", className)}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* Band: page colour, periwinkle, sky, page colour, plus grain. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 [background:linear-gradient(180deg,#fcfcfc_0%,#c3d0f6_26%,#a9bdf0_42%,#bfdcf5_68%,#e3f1fb_86%,#fcfcfc_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 opacity-40 mix-blend-soft-light [background-image:var(--noise-url)] [background-size:512px]"
      />

      <div className="container pb-16 pt-14 md:pb-20 md:pt-[4.25rem]">
        <ol className="mx-auto flex list-none items-center justify-center p-0 md:grid md:w-3/4 md:grid-cols-[auto_1fr_auto_1fr_auto_1fr_auto]">
          {steps.map((step, i) => {
            const isActive = i === active;
            return (
              <li key={step.title} className={cn("contents", !isActive && "max-md:hidden")}>
                {i > 0 ? <span aria-hidden="true" className="hidden h-0.5 bg-white/90 md:block" /> : null}
                <span className={cn(!isActive && "max-md:hidden")}>
                  <button
                    ref={(el) => {
                      pillRefs.current[i] = el;
                    }}
                    type="button"
                    aria-current={isActive ? "step" : undefined}
                    aria-controls={`stepper-panel-${i}`}
                    onClick={() => setActive(i)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-full border border-st bg-white py-2 pl-2 pr-[18px] text-[14px] leading-5 transition-[color,box-shadow] duration-300",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400",
                      isActive ? "text-tx shadow-[0_0.5rem_1.6rem_rgba(0,0,0,0.10)]" : "text-[#9a9a9a] hover:text-tx-tertiary",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "grid size-[26px] place-items-center rounded-full transition-colors duration-300 [&_svg]:size-3.5 [&_svg]:stroke-[1.75]",
                        isActive ? "bg-indigo-100 text-indigo-800" : "bg-sf-tertiary text-[#b3b3b3]",
                      )}
                    >
                      {step.icon}
                    </span>
                    <span className="font-medium">
                      <span className="sr-only">Step {i + 1}: </span>
                      {step.title}
                    </span>
                  </button>
                </span>
              </li>
            );
          })}
        </ol>

        <p aria-live="polite" className="mx-auto mt-5 max-w-[560px] text-balance text-center text-caption leading-[1.55] text-tx-secondary md:text-body">
          {steps[active]?.body}
        </p>

        <figure className="relative mx-auto mt-8 max-w-[1080px] overflow-hidden rounded-2xl border border-st bg-white shadow-[0_0_0_1px_rgba(255,255,255,.72),0_1.35rem_3.8rem_rgba(17,17,91,.14)] md:mt-12 md:rounded-3xl">
          <div className="grid">
            {steps.map((step, i) => (
              <div
                key={step.title}
                id={`stepper-panel-${i}`}
                aria-hidden={i !== active}
                inert={i !== active}
                className={cn(
                  "col-start-1 row-start-1 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]",
                  i === active ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0",
                )}
              >
                {step.panel}
              </div>
            ))}
          </div>
          <figcaption className="sr-only">{steps[active]?.title}</figcaption>
        </figure>

        <div className="mt-4 flex justify-center md:hidden">
          {steps.map((s, i) => (
            <button
              key={s.title}
              type="button"
              aria-label={`Show step ${i + 1}: ${s.title}`}
              aria-current={i === active ? "step" : undefined}
              onClick={() => setActive(i)}
              className="grid h-8 place-items-center px-1"
            >
              <span
                className={cn(
                  "block h-2 rounded-full transition-all duration-300",
                  i === active ? "w-6 bg-ink" : "w-2 bg-[#c9c9c9]",
                )}
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
