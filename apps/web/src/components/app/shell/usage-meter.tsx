"use client";

import * as React from "react";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { cn } from "@/lib/cn";
import type { LlmProvider } from "@/lib/types";
import { useUsage } from "@/hooks/data/useUsage";
import { useAuth } from "@/components/providers";
import { Progress } from "@/components/ui/progress";
import { APP_ROUTES } from "@/components/app/nav";

export const PROVIDER_LABEL: Record<LlmProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  openrouter: "OpenRouter",
  gemini: "Gemini",
};

/** Sidebar footer card: free answers left, or the BYOK provider. */
export function UsageMeter({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const usage = useUsage();

  const plan = usage.data?.plan;
  const tier = plan?.tier ?? user?.plan.tier;
  const provider = usage.data?.apiKey?.provider ?? user?.plan.provider ?? null;

  if (!tier) return <div className="h-[88px] rounded-xl border border-st-secondary bg-bg" aria-hidden="true" />;

  if (tier === "byok") {
    return (
      <Link
        href={APP_ROUTES.models}
        onClick={onNavigate}
        className="flex items-center gap-2.5 rounded-xl border border-st-secondary bg-bg px-3 py-2.5 text-[13px] leading-5 text-tx-secondary transition-colors duration-150 hover:border-st hover:bg-sf-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
      >
        <span className="flex size-6 items-center justify-center rounded-full bg-green-50 text-green-600" aria-hidden="true">
          <KeyRound className="size-3.5" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1 truncate">
          Your key: <span className="text-tx">{provider ? PROVIDER_LABEL[provider] : "connected"}</span>
        </span>
      </Link>
    );
  }

  const limit = plan?.limit ?? user?.plan.freeTierLimit ?? 50;
  const used = plan?.used ?? user?.plan.freeTierUsage ?? 0;
  const left = Math.max(0, plan?.remaining ?? limit - used);
  const ratio = limit > 0 ? used / limit : 0;
  const high = ratio >= 0.9;

  return (
    <div className="rounded-xl border border-st-secondary bg-bg p-3">
      <p className="text-[13px] leading-5 text-tx-secondary">
        {tier === "demo" ? (
          <>
            <span className={cn("tabular-nums", high ? "text-red-400" : "text-tx")}>{left}</span> of {limit} demo
            answers left
          </>
        ) : left === 0 ? (
          <span className="text-red-400">You&apos;ve used all {limit} free answers</span>
        ) : (
          <>
            <span className={cn("tabular-nums", high ? "text-red-400" : "text-tx")}>{left}</span> of {limit} free
            answers left
          </>
        )}
      </p>
      <Progress
        value={used}
        max={limit}
        tone={high ? "red" : "blue"}
        aria-label="Free answers used"
        className="mt-2"
      />
      {tier === "free" ? (
        <Link
          href={APP_ROUTES.models}
          onClick={onNavigate}
          className="mt-2 inline-flex text-[13px] leading-5 text-tx-accent underline decoration-current/25 underline-offset-[3px] transition-colors hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
        >
          Add your own key
        </Link>
      ) : null}
    </div>
  );
}
