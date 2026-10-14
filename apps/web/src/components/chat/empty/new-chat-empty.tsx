"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Check, Database, FileUp, FlaskConical, MessageSquare, Plug, Sheet, X } from "lucide-react";
import { Ornament } from "@/components/ui/ornament";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useAppUI } from "@/components/app/app-ui-provider";
import { useAuth } from "@/components/providers";
import { useUsage } from "@/hooks/data/useUsage";
import { useBridges, useCreateSampleBridge } from "@/hooks/data/useBridges";
import { useFeature } from "@/lib/capabilities";
import { api, errorMessage } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { BridgeSummary, UserDTO } from "@/lib/types";
import { cn } from "@/lib/cn";

/*
 * New-chat screen, split around the composer (which stays mounted when the
 * first message turns this into a thread):
 *   NewChatHero    ornament, greeting, one line of promise
 *   NewChatBelow   onboarding checklist + suggestions from connected data
 */

function greetingFor(hour: number) {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

const noopSubscribe = () => () => {};

function useGreeting() {
  return React.useSyncExternalStore(
    noopSubscribe,
    () => greetingFor(new Date().getHours()),
    () => "Hello",
  );
}

function firstName(user: UserDTO | null): string | null {
  const name = user?.name?.trim();
  if (!name) return null;
  return name.split(/\s+/)[0];
}

export function NewChatHero() {
  const { user } = useAuth();
  const greeting = useGreeting();
  const name = firstName(user);

  return (
    <div className="flex flex-col items-center px-2 text-center">
      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-2xl"
          style={{ background: "var(--gradient-hero-glow)" }}
        />
        <Ornament className="relative h-6 text-indigo-300 md:h-7" />
      </div>
      <h1 className="mt-6 font-display text-[34px] font-display-regular leading-[1.08] tracking-hero text-tx text-balance md:text-[44px]">
        {greeting}
        {name ? `, ${name}` : ""}
      </h1>
      <p className="mt-3 max-w-[460px] text-[16px] leading-[1.6] text-tx-tertiary md:text-[17px]">
        Ask about your data in plain English. Every number shows where it came from.
      </p>
    </div>
  );
}

// ─── Onboarding checklist ───────────────────────────────────────────────────

interface Step {
  key: string;
  title: string;
  description: string;
  done: boolean;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  action?: { label: string; onClick: () => void };
}

function OnboardingChecklist({
  hasBridges,
  hasDocs,
  hasAsked,
}: {
  hasBridges: boolean;
  hasDocs: boolean;
  hasAsked: boolean;
}) {
  const ui = useAppUI();
  const qc = useQueryClient();
  const sampleOn = useFeature("sample");
  const sample = useCreateSampleBridge();

  const dismiss = useMutation({
    meta: { errorMessage: "Couldn't hide the checklist. Try again." },
    mutationFn: () =>
      api<{ user?: UserDTO } | UserDTO>("/user/preferences", {
        method: "PATCH",
        json: { onboarding: { checklistDismissed: true } },
      }),
    onMutate: () => {
      const prev = qc.getQueryData<UserDTO | null>(qk.me);
      if (prev) {
        qc.setQueryData<UserDTO>(qk.me, {
          ...prev,
          onboarding: { ...prev.onboarding, checklistDismissedAt: new Date().toISOString() },
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.me, ctx.prev);
    },
  });

  const steps: Step[] = [
    {
      key: "connect",
      title: "Connect a database or sheet",
      description: "Read-only MongoDB or a Google Sheet.",
      done: hasBridges,
      icon: Plug,
      action: { label: "Connect", onClick: () => ui.openDialog("connect") },
    },
    {
      key: "upload",
      title: "Upload a document",
      description: "PDFs and text files, answered with citations.",
      done: hasDocs,
      icon: FileUp,
      action: { label: "Upload", onClick: () => ui.openDialog("upload") },
    },
    {
      key: "ask",
      title: "Ask your first question",
      description: "Type below and press Enter.",
      done: hasAsked,
      icon: MessageSquare,
      action: {
        label: "Ask",
        onClick: () => window.dispatchEvent(new CustomEvent("wuup:focus-composer")),
      },
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <section
      aria-labelledby="onboarding-title"
      className="relative rounded-2xl border border-st-secondary bg-sf-white p-5 sm:p-6"
      data-testid="onboarding"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="onboarding-title" className="text-[16px] font-medium leading-[1.4] text-tx">
            Get set up
          </h2>
          <p className="mt-0.5 text-[13px] text-tx-tertiary">
            {doneCount} of {steps.length} done
          </p>
        </div>
        <div
          className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-sf-tertiary"
          role="progressbar"
          aria-label="Setup progress"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={doneCount}
        >
          <div
            className="h-full rounded-full bg-indigo-600 transition-[width] duration-500 ease-standard"
            style={{ width: `${(doneCount / steps.length) * 100}%` }}
          />
        </div>
        <button
          type="button"
          aria-label="Hide setup checklist"
          onClick={() => dismiss.mutate()}
          className="-mr-2 -mt-1.5 inline-flex size-8 items-center justify-center rounded-full text-tx-muted transition-colors hover:bg-sf-secondary hover:text-tx focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
        >
          <X className="size-4" strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>

      <ol className="mt-4 flex flex-col">
        {steps.map((s) => (
          <li key={s.key} className="flex items-center gap-3 border-t border-st-secondary py-3 first:border-t-0 first:pt-1">
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full",
                s.done ? "bg-indigo-600 text-white" : "bg-sf-secondary text-tx-tertiary",
              )}
            >
              {s.done ? (
                <Check className="size-4" strokeWidth={2} aria-hidden="true" />
              ) : (
                <s.icon className="size-4" strokeWidth={1.5} />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn("text-[15px] leading-[1.4]", s.done ? "text-tx-tertiary line-through decoration-st" : "text-tx")}>
                {s.title}
                <span className="sr-only">{s.done ? ", done" : ", to do"}</span>
              </p>
              <p className="text-[13px] leading-[1.5] text-tx-tertiary">{s.description}</p>
            </div>
            {!s.done && s.action ? (
              <Button variant="soft" size="sm" onClick={s.action.onClick} className="shrink-0">
                {s.action.label}
              </Button>
            ) : null}
          </li>
        ))}
      </ol>

      {sampleOn && !hasBridges ? (
        <div className="mt-3 flex flex-col gap-3 rounded-xl bg-bg px-4 py-3 sm:flex-row sm:items-center">
          <FlaskConical className="hidden size-4 shrink-0 text-indigo-600 sm:block" strokeWidth={1.5} aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[13px] leading-[1.5] text-tx-tertiary">
            No data handy? Try wuup on a sample store database first.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 self-start sm:self-auto"
            disabled={sample.isPending}
            onClick={() =>
              sample.mutate(undefined, {
                onSuccess: () => toast.success("Sample data connected", { description: "Ask anything about the sample store." }),
                onError: (e) => toast.error("Couldn't add the sample data", { description: errorMessage(e) }),
              })
            }
          >
            {sample.isPending ? "Adding sample data" : "Try with sample data"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

// ─── Suggestions ────────────────────────────────────────────────────────────

interface Suggestion {
  text: string;
  bridge: BridgeSummary;
}

function collectSuggestions(bridges: BridgeSummary[] | undefined, max = 4): Suggestion[] {
  const out: Suggestion[] = [];
  const active = (bridges ?? []).filter((b) => b.status === "active" && b.suggestions.length);
  // Round-robin across bridges so one source does not take every slot.
  for (let i = 0; out.length < max && active.some((b) => b.suggestions[i]); i++) {
    for (const b of active) {
      const s = b.suggestions[i];
      if (s && !out.some((o) => o.text === s)) out.push({ text: s, bridge: b });
      if (out.length >= max) break;
    }
  }
  return out;
}

function SuggestionGrid({ suggestions, onPick }: { suggestions: Suggestion[]; onPick: (text: string) => void }) {
  if (!suggestions.length) return null;
  return (
    <section aria-labelledby="try-asking" data-testid="suggestions">
      <h2 id="try-asking" className="mb-3 text-[12px] font-medium uppercase tracking-[0.17em] text-tx-tertiary">
        Try asking
      </h2>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {suggestions.map((s) => {
          const Icon = s.bridge.type === "sheets" ? Sheet : Database;
          return (
            <li key={`${s.bridge.id}-${s.text}`}>
              <button
                type="button"
                onClick={() => onPick(s.text)}
                className="group/sg flex h-full w-full flex-col gap-3 rounded-2xl border border-st-secondary bg-sf-white p-4 text-left transition-[border-color,box-shadow] duration-200 ease-standard hover:border-st hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
              >
                <span className="text-[15px] leading-[1.5] text-tx-secondary group-hover/sg:text-tx">{s.text}</span>
                <span className="mt-auto flex items-center gap-1.5 text-[12px] text-tx-muted">
                  <Icon className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
                  <span className="truncate">{s.bridge.name}</span>
                  <ArrowUpRight
                    className="ml-auto size-3.5 opacity-0 transition-[opacity,transform] duration-200 group-hover/sg:translate-x-0.5 group-hover/sg:opacity-100"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function NewChatBelow({ onPick }: { onPick: (text: string) => void }) {
  const { user } = useAuth();
  const { data: usage } = useUsage();
  const { data: bridges } = useBridges();
  const suggestions = React.useMemo(() => collectSuggestions(bridges), [bridges]);

  const hasBridges = (usage?.counts.bridges ?? 0) > 0 || !!bridges?.length;
  const hasDocs = (usage?.counts.documents ?? 0) > 0;
  const hasAsked = (usage?.counts.chats ?? 0) > 0 || (usage?.plan.used ?? 0) > 0;
  const allDone = hasBridges && hasDocs && hasAsked;
  const showChecklist = !!user && !user.onboarding?.checklistDismissedAt && !!usage && !allDone;

  if (!showChecklist && !suggestions.length) return null;
  return (
    <div className="flex flex-col gap-8">
      {suggestions.length ? <SuggestionGrid suggestions={suggestions} onPick={onPick} /> : null}
      {showChecklist ? <OnboardingChecklist hasBridges={hasBridges} hasDocs={hasDocs} hasAsked={hasAsked} /> : null}
    </div>
  );
}
