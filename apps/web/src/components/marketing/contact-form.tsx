"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Bug,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Database,
  HelpCircle,
  KeyRound,
  Loader2,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { SITE } from "@/lib/site";

/*
 * Stepped contact form (kit contact.md 2.3 to 2.4): a grey conversational
 * heading per step with a circular step ring, soft 48px inputs with an indigo
 * focus ring, and a floating action bar (Back on the left, ink Continue on the
 * right). Steps: topic, details, review and send. POSTs to
 * `${SITE.apiUrl}/public/contact` with { name, email, topic, message }.
 */

const TOPICS: Array<{ value: string; sub: string; icon: ReactNode }> = [
  { value: "Question about wuup", sub: "How something works", icon: <HelpCircle /> },
  { value: "Report a bug", sub: "Something looks wrong", icon: <Bug /> },
  { value: "Request a data source", sub: "A database or file type", icon: <Database /> },
  { value: "Security or privacy", sub: "How your data is handled", icon: <ShieldCheck /> },
  { value: "Your AI key", sub: "Providers and models", icon: <KeyRound /> },
  { value: "Something else", sub: "Anything at all", icon: <MessageCircle /> },
];

const MAX_MESSAGE = 4000;
const MAX_NAME = 80;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const HEADINGS = ["What can we help with?", "Tell us a little more", "Ready to send?"];

type Status = "idle" | "sending" | "sent";

function StepRing({ step, total }: { step: number; total: number }) {
  const r = 11;
  const c = 2 * Math.PI * r;
  return (
    <span role="img" aria-label={`Step ${step} of ${total}`} className="flex shrink-0 items-center gap-2 text-caption text-tx-tertiary">
      <span aria-hidden="true" className="tabular-nums">
        {step}/{total}
      </span>
      <svg viewBox="0 0 28 28" className="size-7 -rotate-90" aria-hidden="true">
        <circle cx="14" cy="14" r={r} fill="none" stroke="#e6e6e6" strokeWidth="2" />
        <circle
          cx="14"
          cy="14"
          r={r}
          fill="none"
          stroke="var(--color-ink)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - step / total)}
          className="transition-[stroke-dashoffset] duration-500 ease-[cubic-bezier(0.2,0,0,1)]"
        />
      </svg>
    </span>
  );
}

const inputCls =
  "w-full min-h-12 rounded-2xl border border-st-secondary bg-sf-white px-4 py-3 text-[16px] leading-6 text-tx placeholder:text-tx-tertiary transition-[border-color,box-shadow] duration-150 outline-none focus:border-indigo-800 focus:shadow-[0_0_0_2px_rgba(51,51,204,0.2)] aria-[invalid=true]:border-red-400 aria-[invalid=true]:shadow-[0_0_0_2px_var(--red-100)]";

function Field({
  label,
  error,
  hint,
  children,
  id,
}: {
  label: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  id: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="flex items-baseline justify-between text-caption font-medium leading-5 text-tx-secondary">
        <span>
          {label}
          <span className="ml-0.5 text-red-500" aria-hidden="true">
            *
          </span>
        </span>
        {hint}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-[13px] text-red-500">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ContactForm({ className }: { className?: string }) {
  const uid = useId();
  const [step, setStep] = useState(0);
  const [topic, setTopic] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [touched, setTouched] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    headingRef.current?.focus();
  }, [step, status]);

  const errors = {
    name: !name.trim() ? "Tell us what to call you" : name.trim().length > MAX_NAME ? `Keep it under ${MAX_NAME} characters` : undefined,
    email: !EMAIL_RE.test(email.trim()) ? "Enter a valid email so we can reply" : undefined,
    message: !message.trim()
      ? "Write a short message"
      : message.length > MAX_MESSAGE
        ? `Messages are limited to ${MAX_MESSAGE} characters`
        : undefined,
  };
  const detailsValid = !errors.name && !errors.email && !errors.message;
  const canContinue = step === 0 ? !!topic : step === 1 ? detailsValid : status !== "sending";

  async function send() {
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch(`${SITE.apiUrl}/public/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), topic, message: message.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        if (res.status === 429) throw new Error(body?.error ?? "Too many messages. Please try again in an hour.");
        throw new Error(body?.error ?? "We could not send your message. Please try again.");
      }
      setStatus("sent");
    } catch (e) {
      setStatus("idle");
      setError(
        e instanceof TypeError
          ? `We could not reach the server. You can also email ${SITE.email}.`
          : e instanceof Error
            ? e.message
            : "Something went wrong.",
      );
    }
  }

  function next() {
    if (step === 1 && !detailsValid) {
      setTouched(true);
      return;
    }
    if (step < 2) setStep(step + 1);
    else void send();
  }

  if (status === "sent") {
    return (
      <div className={cn("flex flex-1 flex-col justify-center gap-6 px-5 py-14 sm:px-8 lg:px-14", className)}>
        <span className="grid size-14 place-items-center rounded-full bg-green-50 text-green-600 shadow-[inset_0_0_0_1px_var(--green-200)]">
          <CircleCheck className="size-7" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-3" role="status">
          <h2 ref={headingRef} tabIndex={-1} className="font-display text-[28px] font-normal leading-[1.2] text-tx outline-none md:text-[32px]">
            Message sent. Thank you.
          </h2>
          <p className="max-w-md text-body leading-[1.6] text-tx-tertiary">
            We read every message and reply by email to <span className="font-medium text-tx">{email.trim()}</span>, usually within a
            couple of working days.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/" variant="soft">
            Back to home
          </ButtonLink>
          <ButtonLink href="/docs" variant="ghost">
            Browse the docs
          </ButtonLink>
        </div>
      </div>
    );
  }

  const show = (k: keyof typeof errors) => (touched ? errors[k] : undefined);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (canContinue) next();
        else if (step === 1) setTouched(true);
      }}
      className={cn("relative flex min-h-0 flex-1 flex-col", className)}
      aria-labelledby={`${uid}-h`}
    >
      <div className="flex-1 overflow-y-auto px-5 pb-40 pt-8 sm:px-8 lg:px-14 lg:pb-44 lg:pt-14">
        <div className="mb-10 flex items-start justify-between gap-6 lg:mb-12">
          <h2
            ref={headingRef}
            id={`${uid}-h`}
            tabIndex={-1}
            className="text-[24px] font-medium leading-[1.25] tracking-[-0.7px] text-tx-tertiary outline-none lg:text-[28px]"
          >
            {HEADINGS[step]}
          </h2>
          <StepRing step={step + 1} total={3} />
        </div>

        {step === 0 ? (
          <fieldset className="m-0 border-0 p-0">
            <legend className="sr-only">Topic</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {TOPICS.map((t) => {
                const on = topic === t.value;
                return (
                  <label
                    key={t.value}
                    className={cn(
                      "group relative flex cursor-pointer items-center gap-4 rounded-2xl border bg-sf-white px-4 py-4 transition-[border-color,box-shadow,background-color] duration-150",
                      "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-indigo-400",
                      on ? "border-indigo-800 shadow-[0_0_0_2px_rgba(51,51,204,0.15)]" : "border-st-secondary hover:border-st",
                    )}
                  >
                    <input
                      type="radio"
                      name="topic"
                      value={t.value}
                      checked={on}
                      onChange={() => setTopic(t.value)}
                      className="sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className={cn(
                        "grid size-10 shrink-0 place-items-center rounded-xl transition-colors [&_svg]:size-5 [&_svg]:stroke-[1.5]",
                        on ? "bg-indigo-100 text-indigo-800" : "bg-sf-secondary text-tx-secondary",
                      )}
                    >
                      {t.icon}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="text-body font-medium text-tx">{t.value}</span>
                      <span className="text-caption text-tx-tertiary">{t.sub}</span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "ml-auto grid size-5 shrink-0 place-items-center rounded-full border transition-colors",
                        on ? "border-indigo-800 bg-indigo-800" : "border-st",
                      )}
                    >
                      {on ? <span className="size-2 rounded-full bg-white" /> : null}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        {step === 1 ? (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-5">
              <Field id={`${uid}-name`} label="Name" error={show("name")}>
                <input
                  id={`${uid}-name`}
                  className={inputCls}
                  autoComplete="name"
                  placeholder="Ananya Iyer"
                  value={name}
                  maxLength={MAX_NAME + 20}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={!!show("name")}
                  aria-describedby={show("name") ? `${uid}-name-error` : undefined}
                  required
                />
              </Field>
              <Field id={`${uid}-email`} label="Email" error={show("email")}>
                <input
                  id={`${uid}-email`}
                  type="email"
                  className={inputCls}
                  autoComplete="email"
                  inputMode="email"
                  placeholder="ananya@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!!show("email")}
                  aria-describedby={show("email") ? `${uid}-email-error` : undefined}
                  required
                />
              </Field>
            </div>
            <Field
              id={`${uid}-msg`}
              label="Message"
              error={show("message")}
              hint={
                <span className={cn("text-label tabular-nums", message.length > MAX_MESSAGE ? "text-red-500" : "text-tx-muted")}>
                  {message.length}/{MAX_MESSAGE}
                </span>
              }
            >
              <textarea
                id={`${uid}-msg`}
                className={cn(inputCls, "min-h-[180px] resize-y")}
                placeholder={
                  topic === "Request a data source"
                    ? "Which database or file type should wuup read next, and what would you ask it?"
                    : "What are you trying to do, and what happened?"
                }
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                aria-invalid={!!show("message")}
                aria-describedby={show("message") ? `${uid}-msg-error` : undefined}
                required
              />
            </Field>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="flex flex-col gap-4">
            <dl className="m-0 overflow-hidden rounded-2xl border border-st-secondary bg-sf-white">
              {[
                ["Topic", topic, 0],
                ["Name", name.trim(), 1],
                ["Email", email.trim(), 1],
              ].map(([k, v, s]) => (
                <div key={k as string} className="flex items-center gap-4 border-b border-st-secondary px-5 py-3.5">
                  <dt className="w-16 shrink-0 text-caption text-tx-tertiary">{k}</dt>
                  <dd className="m-0 flex min-w-0 flex-1 items-center justify-between gap-4">
                    <span className="truncate text-body text-tx">{v}</span>
                    <button
                      type="button"
                      onClick={() => setStep(s as number)}
                      className="shrink-0 rounded-md text-caption text-indigo-800 hover:text-indigo-900 focus-visible:outline-2 focus-visible:outline-indigo-400"
                    >
                      Edit<span className="sr-only"> {String(k).toLowerCase()}</span>
                    </button>
                  </dd>
                </div>
              ))}
              <div className="flex flex-col gap-2 px-5 py-4">
                <dt className="flex items-center justify-between text-caption text-tx-tertiary">
                  Message
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="rounded-md text-caption text-indigo-800 hover:text-indigo-900 focus-visible:outline-2 focus-visible:outline-indigo-400"
                  >
                    Edit<span className="sr-only"> message</span>
                  </button>
                </dt>
                <dd className="m-0 max-h-40 overflow-y-auto whitespace-pre-wrap text-body leading-[1.6] text-tx-secondary">{message.trim()}</dd>
              </div>
            </dl>
            <p className="text-caption leading-[1.6] text-tx-tertiary">
              We use your email only to reply. See the{" "}
              <a href="/privacy" className="text-tx-secondary underline underline-offset-2 hover:text-tx">
                privacy policy
              </a>
              .
            </p>
          </div>
        ) : null}

        <div aria-live="assertive">
          {error ? (
            <div role="alert" className="mt-6 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-50 px-3 py-2.5 text-[13px] text-red-500">
              <AlertTriangle className="mt-px size-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg from-60% to-transparent px-5 pb-8 pt-16 sm:px-8 lg:px-14 lg:pb-10">
        <div className="pointer-events-auto flex items-center justify-between gap-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="btn btn--soft"
              disabled={status === "sending"}
            >
              <span>
                <ChevronLeft className="size-4" aria-hidden="true" /> Back
              </span>
            </button>
          ) : (
            <span />
          )}
          <button
            type="submit"
            className={cn("btn btn--ink", !canContinue && step !== 1 && "pointer-events-none opacity-40")}
            aria-disabled={!canContinue && step !== 1 ? true : undefined}
          >
            <span className="btn__glow" aria-hidden="true" />
            <span>
              {status === "sending" ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Sending
                </>
              ) : step === 2 ? (
                <>
                  Send message <ChevronRight className="size-4" aria-hidden="true" />
                </>
              ) : (
                <>
                  Continue <ChevronRight className="size-4" aria-hidden="true" />
                </>
              )}
            </span>
          </button>
        </div>
      </div>
    </form>
  );
}
