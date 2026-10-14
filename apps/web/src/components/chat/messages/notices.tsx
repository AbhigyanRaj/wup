"use client";

import { CircleAlert, KeyRound, RotateCcw } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { FACTS } from "@/lib/site";

/** An answer that failed, with a retry. */
export function ErrorInline({
  message,
  onRetry,
  retrying,
}: {
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <div
      role="alert"
      className="mt-4 flex flex-col gap-3 rounded-2xl border border-red-100 bg-sf-white px-4 py-3.5 sm:flex-row sm:items-center"
      data-testid="answer-error"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-400">
          <CircleAlert className="size-4" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-medium text-tx">This answer didn&apos;t finish</p>
          <p className="text-[14px] leading-[1.5] text-tx-tertiary">{message}</p>
        </div>
      </div>
      {onRetry ? (
        <Button
          variant="soft"
          size="sm"
          onClick={onRetry}
          disabled={retrying}
          leadingIcon={<RotateCcw className="size-3.5" strokeWidth={1.5} aria-hidden="true" />}
          className="shrink-0 self-start sm:self-auto"
        >
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/** Shown when the free tier is used up. */
export function FreeLimitCard({ limit }: { limit?: number | null }) {
  const n = limit ?? FACTS.freeQuestions;
  return (
    <div
      role="alert"
      data-testid="free-limit"
      className="relative mt-2 overflow-hidden rounded-2xl border border-indigo-200 bg-sf-white p-5 sm:p-6"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full opacity-70 blur-3xl"
        style={{ background: "var(--gradient-hero-glow)" }}
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-800 ring-1 ring-indigo-100">
          <KeyRound className="size-[18px]" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-medium leading-[1.4] text-tx">You&apos;ve used all {n} free answers.</p>
          <p className="mt-0.5 text-[14px] leading-[1.55] text-tx-tertiary">Add your own API key to keep going.</p>
        </div>
        <ButtonLink href="/settings/models" variant="ink" size="sm" className="self-start sm:self-auto">
          Add key
        </ButtonLink>
      </div>
    </div>
  );
}
