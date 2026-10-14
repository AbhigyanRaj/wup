"use client";

import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, FileSpreadsheet } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import {
  bridgesApi,
  SHEETS_URL_RE,
  waitForScan,
  type BridgeDetails,
  type SheetsTestResult,
} from "@/lib/bridges";
import { qk } from "@/lib/query-keys";
import { connectionError, type ConnectionErrorInfo } from "./connection-errors";
import { ErrorCallout, SectionLabel } from "./parts";

export type SheetsStep = "s-url" | "s-tabs" | "s-name" | "s-saving" | "s-ready";
export const SHEETS_STEPS: SheetsStep[] = ["s-url", "s-tabs", "s-name"];
export const SHEETS_STEP_LABELS = ["Share your sheet", "Choose tabs", "Name"] as const;

export function useSheetsWizard() {
  const qc = useQueryClient();
  const [step, setStep] = useState<SheetsStep>("s-url");
  const [url, setUrlRaw] = useState("");
  const [touched, setTouched] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<ConnectionErrorInfo | null>(null);
  const [test, setTest] = useState<SheetsTestResult | null>(null);
  const [tabs, setTabs] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [created, setCreated] = useState<BridgeDetails | null>(null);

  const urlValid = SHEETS_URL_RE.test(url.trim());

  const setUrl = (v: string) => {
    setUrlRaw(v);
    setError(null);
  };

  const runTest = useCallback(async () => {
    setTouched(true);
    if (!SHEETS_URL_RE.test(url.trim()) || testing) return;
    setTesting(true);
    setError(null);
    try {
      const r = await bridgesApi.testSheets(url.trim());
      setTest(r);
      setTabs(r.tabs.map((t) => t.name));
      setName((n) => n || r.title || "Google Sheet");
      setStep("s-tabs");
    } catch (e) {
      setError(connectionError(e, "sheets"));
    } finally {
      setTesting(false);
    }
  }, [url, testing]);

  const save = useCallback(async () => {
    if (!test) return;
    setStep("s-saving");
    setError(null);
    try {
      const all = tabs.length === test.tabs.length;
      const { id } = await bridgesApi.create({
        name: name.trim() || test.title,
        type: "sheets",
        config: url.trim(),
        scope: [{ db: test.spreadsheetId, collections: all ? ["*"] : tabs }],
      });
      void qc.invalidateQueries({ queryKey: qk.bridges.list });
      const details = await waitForScan(id, setCreated);
      setCreated(details);
      void qc.invalidateQueries({ queryKey: qk.bridges.all });
      void qc.invalidateQueries({ queryKey: qk.usage });
      setStep("s-ready");
    } catch (e) {
      setError(connectionError(e, "sheets"));
      setStep("s-name");
    }
  }, [test, tabs, name, url, qc]);

  const next = useCallback(() => {
    if (step === "s-url") void runTest();
    else if (step === "s-tabs" && tabs.length > 0) setStep("s-name");
    else if (step === "s-name" && name.trim()) void save();
  }, [step, tabs.length, name, runTest, save]);

  const back = useCallback((): boolean => {
    if (step === "s-tabs") {
      setStep("s-url");
      return true;
    }
    if (step === "s-name") {
      setStep("s-tabs");
      return true;
    }
    return false;
  }, [step]);

  const reset = useCallback(() => {
    setStep("s-url");
    setUrlRaw("");
    setTouched(false);
    setTesting(false);
    setError(null);
    setTest(null);
    setTabs([]);
    setName("");
    setCreated(null);
  }, []);

  const toggleTab = (t: string) => setTabs((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  return {
    step,
    url,
    setUrl,
    urlValid,
    touched,
    setTouched,
    testing,
    error,
    test,
    tabs,
    setTabs,
    toggleTab,
    name,
    setName,
    created,
    next,
    back,
    reset,
  };
}

export type SheetsWizard = ReturnType<typeof useSheetsWizard>;

/* ------------------------------------------------------------------ */

function ServiceAccountCard() {
  const q = useQuery({
    queryKey: ["connections", "sheets", "service-account"],
    queryFn: () => bridgesApi.sheetsServiceAccount(),
    staleTime: 60 * 60_000,
    retry: 1,
  });
  const [copied, setCopied] = useState(false);
  const email = q.data?.email;

  async function copy() {
    if (!email) return;
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked: the address is selectable */
    }
  }

  return (
    <div className="rounded-2xl border border-st-secondary bg-sf-secondary/40 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink text-[12px] font-medium text-white">1</span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium text-tx">Share your sheet with this address as a Viewer</p>
          <p className="mt-0.5 text-[13px] text-tx-tertiary">
            In Google Sheets, click Share, paste the address, choose Viewer and send. wuup can only read.
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-full border border-st bg-sf-white py-1 pl-4 pr-1">
            {q.isLoading ? (
              <Skeleton className="h-4 flex-1" />
            ) : (
              <code className="min-w-0 flex-1 select-all truncate font-mono text-[13px] text-tx" data-testid="service-account">
                {email ?? "Service account unavailable"}
              </code>
            )}
            <button
              type="button"
              onClick={copy}
              disabled={!email}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-sf-secondary px-3 text-[13px] font-medium text-tx transition-colors duration-200 hover:bg-sf-tertiary disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
            >
              {copied ? (
                <Check className="size-3.5 text-green-600" strokeWidth={2} aria-hidden="true" />
              ) : (
                <Copy className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SheetsUrlStep({ w }: { w: SheetsWizard }) {
  const showFormat = w.touched && w.url.trim().length > 0 && !w.urlValid;
  return (
    <div className="flex flex-col gap-5">
      <ServiceAccountCard />
      <div className="flex items-start gap-3 px-4">
        <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-ink text-[12px] font-medium text-white">2</span>
        <Field
          className="min-w-0 flex-1"
          label="Paste the sheet URL"
          error={showFormat ? "Paste a docs.google.com/spreadsheets link or a spreadsheet id." : undefined}
        >
          <Input
            autoFocus
            value={w.url}
            spellCheck={false}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            onChange={(e) => w.setUrl(e.target.value)}
            onBlur={() => w.setTouched(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                w.next();
              }
            }}
            data-testid="sheets-url"
          />
        </Field>
      </div>
      {w.error ? <ErrorCallout error={w.error} /> : null}
    </div>
  );
}

export function SheetsTabsStep({ w }: { w: SheetsWizard }) {
  const test = w.test;
  if (!test) return null;
  const all = w.tabs.length === test.tabs.length;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-green-50 text-green-700">
          <FileSpreadsheet className="size-[18px]" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-tx">{test.title}</p>
          <p className="text-[13px] text-tx-tertiary">
            {test.tabs.length} tab{test.tabs.length === 1 ? "" : "s"} found
          </p>
        </div>
        <button
          type="button"
          onClick={() => w.setTabs(all ? [] : test.tabs.map((t) => t.name))}
          className="rounded-full px-3 py-1.5 text-[13px] font-medium text-indigo-800 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-indigo-400"
        >
          {all ? "Clear all" : "Select all"}
        </button>
      </div>
      <ul className="overflow-hidden rounded-2xl border border-st bg-sf-white">
        {test.tabs.map((t, i) => {
          const id = `tab-${i}`;
          const on = w.tabs.includes(t.name);
          return (
            <li key={t.name} className="border-t border-st-secondary first:border-t-0">
              <label htmlFor={id} className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-sf-secondary/60">
                <Checkbox id={id} checked={on} onCheckedChange={() => w.toggleTab(t.name)} />
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-[14px]", on ? "text-tx" : "text-tx-tertiary")}>{t.name}</span>
                  {t.headers.length ? (
                    <span className="block truncate font-mono text-[12px] text-tx-muted">{t.headers.slice(0, 6).join(", ")}</span>
                  ) : null}
                </span>
                <span className="shrink-0 text-[13px] tabular-nums text-tx-tertiary">
                  {t.rows.toLocaleString("en-US")} rows
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function SheetsNameStep({ w }: { w: SheetsWizard }) {
  return (
    <div className="flex flex-col gap-5">
      <Field label="Name" hint="Shown in your data sources list and in answers.">
        <Input
          autoFocus
          value={w.name}
          maxLength={80}
          onChange={(e) => w.setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              w.next();
            }
          }}
        />
      </Field>
      <div className="rounded-2xl border border-st-secondary bg-sf-secondary/40 px-5 py-4">
        <SectionLabel className="mb-2">wuup will read</SectionLabel>
        <p className="text-[14px] text-tx-secondary">{w.tabs.join(", ")}</p>
      </div>
      {w.error ? <ErrorCallout error={w.error} /> : null}
    </div>
  );
}
