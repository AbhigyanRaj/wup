"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Stepper } from "@/components/ui/stepper";
import { toast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useFeature } from "@/lib/capabilities";
import type { BridgeSummary } from "@/lib/bridges";
import { useCreateSampleBridge } from "@/hooks/data/useBridges";
import { MongoNameStep, MongoPickStep, MongoPrivacyStep, MongoUrlStep } from "./mongo-steps";
import { SourcePicker } from "./source-picker";
import {
  SHEETS_STEP_LABELS,
  SHEETS_STEPS,
  SheetsNameStep,
  SheetsTabsStep,
  SheetsUrlStep,
  useSheetsWizard,
} from "./sheets-wizard";
import { MONGO_STEP_LABELS, MONGO_STEPS, useMongoWizard, type MongoStep } from "./use-mongo-wizard";
import { ReadyView, SavingView } from "./wizard-views";

export interface ConnectDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "sample" adds the sample dataset straight away (when the server offers it). */
  initialType?: "mongodb" | "sheets" | "sample";
}

type Source = "mongodb" | "sheets" | null;

const MONGO_TITLES: Record<MongoStep, { title: string; description?: string }> = {
  "m-url": { title: "Connect MongoDB", description: "Paste a connection string. wuup tests it before anything is saved." },
  "m-pick": { title: "Choose what wuup can read", description: "Only the collections you tick are ever queried." },
  "m-privacy": { title: "Hide sensitive fields", description: "Hidden fields never leave your database in an answer." },
  "m-name": { title: "Name this source" },
  "m-saving": { title: "Learning your data" },
  "m-ready": { title: "You're connected" },
};

const SHEETS_TITLES = {
  "s-url": { title: "Connect Google Sheets", description: "Two quick steps: share, then paste the link." },
  "s-tabs": { title: "Choose tabs", description: "wuup reads only the tabs you keep." },
  "s-name": { title: "Name this source" },
  "s-saving": { title: "Reading your sheet" },
  "s-ready": { title: "You're connected" },
} as const;

export default function ConnectDataDialog({ open, onOpenChange, initialType }: ConnectDataDialogProps) {
  const router = useRouter();
  const sheetsEnabled = useFeature("sheets");
  const sampleEnabled = useFeature("sample");
  const mongo = useMongoWizard();
  const sheets = useSheetsWizard();
  const initialSource: Source = initialType === "mongodb" || initialType === "sheets" ? initialType : null;
  const [source, setSource] = useState<Source>(initialSource);
  const [sample, setSample] = useState<BridgeSummary | null>(null);
  const createSample = useCreateSampleBridge();
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sampleStarted = useRef(false);
  const trySampleRef = useRef<() => Promise<void>>(async () => {});
  const { reset: resetMongo } = mongo;
  const { reset: resetSheets } = sheets;

  // Honour initialType on every open (state adjusted during render, not in an effect).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setSource(initialSource);
  }

  // Reset after the close animation; start the sample right away when asked to.
  useEffect(() => {
    if (open) {
      if (resetTimer.current) clearTimeout(resetTimer.current);
      if (initialType === "sample" && !sampleStarted.current) {
        sampleStarted.current = true;
        void trySampleRef.current();
      }
      return;
    }
    resetTimer.current = setTimeout(() => {
      resetMongo();
      resetSheets();
      setSample(null);
      setSource(null);
      sampleStarted.current = false;
    }, 300);
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, [open, initialType, resetMongo, resetSheets]);

  const close = () => onOpenChange(false);

  async function trySample() {
    try {
      const res = await createSample.mutateAsync();
      setSample(res.connection);
    } catch (e) {
      toast.error("Couldn't add the sample data", { description: errorMessage(e) });
    }
  }
  useLayoutEffect(() => {
    trySampleRef.current = trySample;
  });

  /* ---------------- header ---------------- */
  let title: React.ReactNode = "Connect data";
  let description: React.ReactNode = "Pick a source. wuup only ever reads from it.";
  let stepper: { labels: readonly string[]; current: number } | null = null;

  if (sample) {
    title = "Sample data is ready";
    description = undefined;
  } else if (source === "mongodb") {
    const t = MONGO_TITLES[mongo.state.step];
    title = t.title;
    description = t.description;
    const i = MONGO_STEPS.indexOf(mongo.state.step);
    if (i >= 0) stepper = { labels: MONGO_STEP_LABELS, current: i + 1 };
  } else if (source === "sheets") {
    const t = SHEETS_TITLES[sheets.step];
    title = t.title;
    description = "description" in t ? t.description : undefined;
    const i = SHEETS_STEPS.indexOf(sheets.step);
    if (i >= 0) stepper = { labels: SHEETS_STEP_LABELS, current: i + 1 };
  }

  /* ---------------- body ---------------- */
  let body: React.ReactNode;
  if (sample) {
    body = <ReadyView bridge={sample} onNavigate={close} />;
  } else if (createSample.isPending && !source) {
    body = <SavingView title="Adding sample data" body="A small read-only dataset, so you can try wuup before connecting your own." />;
  } else if (source === "mongodb") {
    const s = mongo.state;
    body =
      s.step === "m-url" ? (
        <MongoUrlStep w={mongo} />
      ) : s.step === "m-pick" ? (
        <MongoPickStep w={mongo} />
      ) : s.step === "m-privacy" ? (
        <MongoPrivacyStep w={mongo} />
      ) : s.step === "m-name" ? (
        <MongoNameStep w={mongo} />
      ) : s.step === "m-saving" ? (
        <SavingView
          body="wuup reads a small sample of each collection to learn field names and types, so answers use your real schema."
          progress={
            s.created && s.created.stats.collections > 0
              ? `${s.created.stats.collections} collection${s.created.stats.collections === 1 ? "" : "s"} sampled so far`
              : null
          }
        />
      ) : s.created ? (
        <ReadyView bridge={s.created} onNavigate={close} />
      ) : null;
  } else if (source === "sheets") {
    body =
      sheets.step === "s-url" ? (
        <SheetsUrlStep w={sheets} />
      ) : sheets.step === "s-tabs" ? (
        <SheetsTabsStep w={sheets} />
      ) : sheets.step === "s-name" ? (
        <SheetsNameStep w={sheets} />
      ) : sheets.step === "s-saving" ? (
        <SavingView title="Reading your sheet" body="wuup is reading headers and a few rows from each tab." />
      ) : sheets.created ? (
        <ReadyView bridge={sheets.created} onNavigate={close} />
      ) : null;
  } else {
    body = (
      <div className="flex flex-col gap-5">
        <SourcePicker onPick={setSource} sheetsEnabled={sheetsEnabled} />
        {sampleEnabled ? (
          <button
            type="button"
            onClick={trySample}
            disabled={createSample.isPending}
            className="mx-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[14px] text-tx-tertiary transition-colors hover:bg-sf-secondary hover:text-tx disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
            data-testid="try-sample"
          >
            <FlaskConical className="size-4 text-indigo-600" strokeWidth={1.5} aria-hidden="true" />
            {createSample.isPending ? "Adding sample data..." : "Or try with sample data"}
          </button>
        ) : null}
      </div>
    );
  }

  /* ---------------- footer ---------------- */
  let footer: React.ReactNode = null;
  const done = (
    <>
      <Button
        variant="soft"
        className="sm:mr-auto"
        onClick={() => {
          close();
          router.push("/data");
        }}
      >
        View data sources
      </Button>
      <Button variant="ink" onClick={close} data-testid="wizard-done">
        Done
      </Button>
    </>
  );

  if (sample) footer = done;
  else if (source === "mongodb") {
    const s = mongo.state;
    if (s.step === "m-ready") footer = done;
    else if (s.step !== "m-saving") {
      const primaryLabel =
        s.step === "m-url"
          ? s.testing
            ? "Testing connection..."
            : "Test connection"
          : s.step === "m-pick"
            ? `Continue with ${mongo.count} collection${mongo.count === 1 ? "" : "s"}`
            : s.step === "m-privacy"
              ? "Continue"
              : "Connect";
      const disabled =
        (s.step === "m-url" && (!s.url.trim() || s.testing)) ||
        (s.step === "m-pick" && mongo.count === 0) ||
        (s.step === "m-name" && !s.name.trim());
      footer = (
        <>
          <Button
            variant="soft"
            className="sm:mr-auto"
            onClick={() => {
              if (!mongo.back()) setSource(null);
            }}
          >
            Back
          </Button>
          <Button variant="ink" onClick={mongo.next} disabled={disabled} aria-busy={s.testing || undefined} data-testid="wizard-next">
            {primaryLabel}
          </Button>
        </>
      );
    }
  } else if (source === "sheets") {
    if (sheets.step === "s-ready") footer = done;
    else if (sheets.step !== "s-saving") {
      const label =
        sheets.step === "s-url"
          ? sheets.testing
            ? "Checking access..."
            : "Check access"
          : sheets.step === "s-tabs"
            ? `Continue with ${sheets.tabs.length} tab${sheets.tabs.length === 1 ? "" : "s"}`
            : "Connect";
      const disabled =
        (sheets.step === "s-url" && (!sheets.url.trim() || sheets.testing)) ||
        (sheets.step === "s-tabs" && sheets.tabs.length === 0) ||
        (sheets.step === "s-name" && !sheets.name.trim());
      footer = (
        <>
          <Button
            variant="soft"
            className="sm:mr-auto"
            onClick={() => {
              if (!sheets.back()) setSource(null);
            }}
          >
            Back
          </Button>
          <Button variant="ink" onClick={sheets.next} disabled={disabled} data-testid="wizard-next">
            {label}
          </Button>
        </>
      );
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="md"
      className="sm:max-w-[560px]!"
      footer={footer}
    >
      <div className="flex flex-col gap-6" data-testid="connect-dialog">
        {stepper ? <Stepper steps={stepper.labels} current={stepper.current} /> : null}
        {body}
      </div>
    </Dialog>
  );
}

export { ConnectDataDialog };
