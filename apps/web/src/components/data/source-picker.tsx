"use client";

import { useState } from "react";
import { Check, ChevronRight, Database, FileSpreadsheet, Server } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { bridgesApi } from "@/lib/bridges";
import { cn } from "@/lib/cn";

const WAITLIST_KEY = "wuup_waitlist_postgresql";

function Tile({ tone, children }: { tone: "blue" | "green" | "grey"; children: React.ReactNode }) {
  const bg = {
    blue: "linear-gradient(160deg, #5b8def 0%, #a5d8fb 100%)",
    green: "linear-gradient(160deg, #6ea335 0%, #c6e3a0 100%)",
    grey: "linear-gradient(160deg, #cfd3dc 0%, #f0f1f5 100%)",
  }[tone];
  return (
    <span
      aria-hidden="true"
      className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-2px_6px_rgba(0,0,0,0.06)] sm:size-[72px]"
      style={{ background: bg }}
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.55),transparent_60%)]" />
      <span className="relative text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.12)] [&_svg]:size-7 [&_svg]:stroke-[1.5]">
        {children}
      </span>
    </span>
  );
}

interface OptionProps {
  title: string;
  description: string;
  tile: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  badge?: React.ReactNode;
  footer?: React.ReactNode;
  testId?: string;
}

/** Kit option card (.option-card) as a full-width button. */
function SourceOption({ title, description, tile, onClick, disabled, badge, footer, testId }: OptionProps) {
  const body = (
    <>
      {tile}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[17px] font-medium leading-[1.3] tracking-[-0.01em] text-tx">{title}</span>
          {badge}
        </span>
        <span className="mt-1 text-[14px] leading-[1.5] text-tx-tertiary">{description}</span>
        {footer}
      </span>
    </>
  );
  if (disabled) {
    return (
      <div
        className="option-card items-start! gap-4! rounded-[22px]! p-3! sm:items-center! sm:p-4!"
        // A card with its own action (the waitlist button) must not mark that button disabled.
        aria-disabled={footer ? undefined : "true"}
        data-testid={testId}
      >
        {body}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "option-card group w-full gap-4! rounded-[22px]! p-3! text-left sm:p-4!",
        "transition-[border-color,box-shadow,background-color] duration-200 ease-standard",
        "hover:border-indigo-200 hover:shadow-card",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400",
      )}
    >
      {body}
      <ChevronRight
        className="size-5 shrink-0 text-tx-muted transition-[translate,color] duration-200 ease-standard group-hover:translate-x-0.5 group-hover:text-indigo-600"
        strokeWidth={1.5}
        aria-hidden="true"
      />
    </button>
  );
}

function WaitlistButton() {
  const [state, setState] = useState<"idle" | "pending" | "joined">(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(WAITLIST_KEY) ? "joined" : "idle";
    } catch {
      return "idle";
    }
  });

  if (state === "joined") {
    return (
      <span className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-green-700" role="status">
        <Check className="size-3.5" strokeWidth={2} aria-hidden="true" />
        You&apos;re on the list
      </span>
    );
  }
  return (
    <button
      type="button"
      disabled={state === "pending"}
      onClick={async () => {
        setState("pending");
        try {
          await bridgesApi.joinWaitlist("postgresql");
          setState("joined");
          try {
            localStorage.setItem(WAITLIST_KEY, "1");
          } catch {
            /* ignore */
          }
        } catch (e) {
          setState("idle");
          toast.error("Couldn't join the waitlist", { description: errorMessage(e) });
        }
      }}
      className="mt-2 w-fit rounded-md text-[13px] font-medium text-indigo-800 underline decoration-indigo-200 underline-offset-4 hover:decoration-indigo-600 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
    >
      {state === "pending" ? "Joining..." : "Join the waitlist"}
    </button>
  );
}

export function SourcePicker({
  onPick,
  sheetsEnabled,
}: {
  onPick: (type: "mongodb" | "sheets") => void;
  sheetsEnabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-2" role="list" aria-label="Data sources">
      <div role="listitem">
        <SourceOption
          testId="source-mongodb"
          title="MongoDB"
          description="Atlas or any reachable cluster. Read only, schema-aware."
          tile={
            <Tile tone="blue">
              <Database />
            </Tile>
          }
          onClick={() => onPick("mongodb")}
        />
      </div>
      <div role="listitem">
        <SourceOption
          testId="source-sheets"
          title="Google Sheets"
          description={sheetsEnabled ? "Share a sheet with wuup as a Viewer." : "Not configured on this server yet."}
          disabled={!sheetsEnabled}
          badge={sheetsEnabled ? null : <span className="pill pill--neutral text-[12px]!">Not configured</span>}
          tile={
            <Tile tone={sheetsEnabled ? "green" : "grey"}>
              <FileSpreadsheet />
            </Tile>
          }
          onClick={() => onPick("sheets")}
        />
      </div>
      <div role="listitem">
        <SourceOption
          testId="source-postgresql"
          title="PostgreSQL"
          description="We'll let you know when it's ready."
          disabled
          badge={<span className="pill pill--info text-[12px]!">Coming soon</span>}
          tile={
            <Tile tone="grey">
              <Server />
            </Tile>
          }
          footer={<WaitlistButton />}
        />
      </div>
    </div>
  );
}
