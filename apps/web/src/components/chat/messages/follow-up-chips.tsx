"use client";

import { CornerDownRight } from "lucide-react";
import type { FollowUp } from "@/lib/types";

/** Suggested next questions (kit .chip), on the last answer only, when idle. */
export function FollowUpChips({ followUps, onPick }: { followUps: FollowUp[]; onPick: (prompt: string) => void }) {
  if (!followUps.length) return null;
  return (
    <div className="mt-6" data-testid="follow-ups">
      <p className="mb-2 text-[12px] font-medium uppercase tracking-[0.12em] text-tx-tertiary">Ask next</p>
      <ul className="flex flex-wrap gap-2">
        {followUps.map((f) => (
          <li key={f.label}>
            <button
              type="button"
              onClick={() => onPick(f.suggestedPrompt || f.label)}
              className="chip is-active inline-flex max-w-full items-center gap-2 text-left text-tx-secondary shadow-[0_1px_2px_rgb(0_0_0/0.03)] hover:border-indigo-200 hover:text-tx focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
            >
              <CornerDownRight className="size-3.5 shrink-0 text-indigo-600" strokeWidth={1.5} aria-hidden="true" />
              <span className="truncate">{f.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
