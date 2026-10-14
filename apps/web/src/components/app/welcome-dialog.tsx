"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Database, MessageSquareText, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { UserDTO } from "@/lib/types";
import { Dialog, dialogButtonClass } from "@/components/ui/dialog";
import { Ornament } from "@/components/ui/ornament";
import { useAppUI } from "./app-ui-provider";
import { APP_ROUTES } from "./nav";
import { markWelcomeSeenLocally } from "./welcome-state";

const rowClass =
  "group/wrow flex w-full items-center gap-3.5 py-3.5 text-left outline-none transition-colors focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400";

function RowBody({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <>
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sf-white text-tx-secondary shadow-[0_0_0_1px_#f0f0f0,0_1px_3px_#00000014] transition-colors group-hover/wrow:text-indigo-600 [&_svg]:size-[18px] [&_svg]:stroke-[1.5]"
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-medium leading-6 text-tx">{title}</span>
        <span className="text-[14px] leading-5 text-tx-tertiary">{body}</span>
      </span>
      <ArrowRight
        className="size-[18px] shrink-0 text-st transition-[color,transform] duration-200 ease-standard group-hover/wrow:translate-x-0.5 group-hover/wrow:text-tx-tertiary"
        strokeWidth={1.75}
        aria-hidden="true"
      />
    </>
  );
}

export default function WelcomeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const qc = useQueryClient();
  const router = useRouter();
  const { openDialog } = useAppUI();
  const recorded = React.useRef(false);
  const focusRef = React.useRef<HTMLDivElement>(null);

  const markSeen = React.useCallback(() => {
    if (recorded.current) return;
    recorded.current = true;
    markWelcomeSeenLocally();
    const now = new Date().toISOString();
    qc.setQueryData<UserDTO | null>(qk.me, (u) =>
      u ? { ...u, onboarding: { ...u.onboarding, welcomeSeenAt: u.onboarding?.welcomeSeenAt ?? now } } : u,
    );
    void api("/user/preferences", { method: "PATCH", json: { onboarding: { welcomeSeen: true } } }).catch(() => {
      /* the localStorage flag keeps it from showing again */
    });
  }, [qc]);

  const close = (next: boolean) => {
    if (!next) markSeen();
    onOpenChange(next);
  };

  const connect = () => {
    markSeen();
    onOpenChange(false);
    openDialog("connect");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      size="md"
      hideClose
      initialFocusRef={focusRef}
      title={
        <span className="flex flex-col items-center pt-2 text-center">
          <Ornament className="h-6 text-indigo-300" />
          <span className="mt-4 font-display text-[30px] font-display-medium leading-[1.15] tracking-heading text-tx">
            Welcome to wuup
          </span>
          <span className="mt-2 max-w-[400px] font-sans text-[15px] font-normal leading-6 tracking-normal text-tx-tertiary">
            Three steps to your first answer.
          </span>
        </span>
      }
      footer={
        <>
          <button type="button" className={dialogButtonClass.soft} onClick={() => close(false)}>
            Explore first
          </button>
          <button type="button" className={dialogButtonClass.ink} onClick={connect}>
            Connect data
          </button>
        </>
      }
    >
      <div ref={focusRef} tabIndex={-1} className="-mt-1 divide-y divide-st-secondary outline-none">
        <button type="button" className={rowClass} onClick={connect}>
          <RowBody
            icon={<Database />}
            title="Connect your data"
            body="MongoDB (read-only), Google Sheets or your own PDFs."
          />
        </button>
        <button
          type="button"
          className={rowClass}
          onClick={() => {
            close(false);
            router.push(APP_ROUTES.newChat);
            window.setTimeout(() => window.dispatchEvent(new CustomEvent("wuup:focus-composer")), 350);
          }}
        >
          <RowBody
            icon={<MessageSquareText />}
            title="Ask in plain English"
            body="Charts and tables are built from the rows your query returns."
          />
        </button>
        <Link href="/docs/getting-started" target="_blank" rel="noopener" className={rowClass} onClick={() => close(false)}>
          <RowBody
            icon={<ShieldCheck />}
            title="Check every answer"
            body="See the queries used and the cited sources behind each reply."
          />
        </Link>
      </div>
    </Dialog>
  );
}
