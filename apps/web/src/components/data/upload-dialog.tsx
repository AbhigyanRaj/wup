"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CircleAlert, CircleCheck, FileText, RotateCw, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { acceptAttr, formatBytes, formatsLabel } from "@/lib/knowledge";
import { clearFinished, dismiss, enqueue, retry, useUploads, type UploadItem } from "@/lib/upload";
import { useKnowledgeConfig, useSourcesChangedSync } from "@/hooks/data/useKnowledge";

export interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function UploadRow({ item, onNavigate }: { item: UploadItem; onNavigate: () => void }) {
  const { phase } = item;
  return (
    <li
      className="flex items-start gap-3 rounded-2xl border border-st-secondary bg-sf-white px-4 py-3"
      data-testid="upload-row"
      data-phase={phase}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl",
          phase === "failed" ? "bg-red-50 text-red-400" : phase === "ready" ? "bg-green-50 text-green-600" : "bg-blue-50 text-blue-600",
        )}
      >
        <FileText className="size-[18px]" strokeWidth={1.5} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-[14px] font-medium text-tx" title={item.name}>
            {item.name}
          </p>
          {phase === "ready" ? (
            <span className="pill pill--success shrink-0 text-[12px]!">Ready</span>
          ) : phase === "failed" ? (
            <span className="pill pill--error shrink-0 text-[12px]!">Failed</span>
          ) : phase === "duplicate" ? (
            <span className="pill pill--neutral shrink-0 text-[12px]!">Already uploaded</span>
          ) : null}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] leading-5 text-tx-tertiary">
          <span className="tabular-nums">{formatBytes(item.size)}</span>
          {phase === "uploading" ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums text-blue-700">Uploading {Math.round(item.progress * 100)}%</span>
            </>
          ) : null}
          {phase === "indexing" ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums text-tx-secondary" data-testid="indexing-label">
                {item.slow
                  ? "Still indexing. We'll keep checking."
                  : item.chunks && item.chunks.total > 0
                    ? `Indexing ${item.chunks.done.toLocaleString("en-US")} of ${item.chunks.total.toLocaleString("en-US")} chunks`
                    : "Indexing"}
              </span>
            </>
          ) : null}
          {phase === "ready" ? (
            <>
              <span aria-hidden="true">·</span>
              <span>Ready to ask about</span>
            </>
          ) : null}
          {phase === "duplicate" ? (
            <>
              <span aria-hidden="true">·</span>
              <Link
                href="/data?tab=documents"
                onClick={onNavigate}
                className="font-medium text-indigo-800 underline decoration-indigo-200 underline-offset-2 hover:decoration-indigo-600"
              >
                View
              </Link>
            </>
          ) : null}
        </div>
        {phase === "failed" && item.error ? (
          <p className="mt-1 text-[13px] leading-5 text-red-400" role="alert">
            {item.error}
          </p>
        ) : null}
        {phase === "uploading" ? (
          <Progress value={item.progress * 100} tone="blue" className="mt-2" aria-label={`Uploading ${item.name}`} />
        ) : null}
        {phase === "indexing" ? (
          <Progress
            value={item.chunks && item.chunks.total > 0 ? (item.chunks.done / item.chunks.total) * 100 : null}
            tone="indigo"
            className="mt-2"
            aria-label={`Indexing ${item.name}`}
          />
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {phase === "failed" && item.canRetry ? (
          <button
            type="button"
            onClick={() => void retry(item.key)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-sf-secondary px-3 text-[13px] font-medium text-tx hover:bg-sf-tertiary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
          >
            <RotateCw className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
            Retry
          </button>
        ) : null}
        {phase === "uploading" ? <Spinner size="sm" label={null} /> : null}
        {phase === "ready" ? <CircleCheck className="size-4 text-green-600" strokeWidth={1.5} aria-hidden="true" /> : null}
        {phase !== "indexing" ? (
          <button
            type="button"
            onClick={() => dismiss(item.key)}
            aria-label={phase === "uploading" ? `Cancel ${item.name}` : `Dismiss ${item.name}`}
            className="grid size-8 place-items-center rounded-full text-tx-muted transition-colors hover:bg-sf-secondary hover:text-tx focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
          >
            <X className="size-4" strokeWidth={1.5} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </li>
  );
}

export default function UploadDialog({ open, onOpenChange }: UploadDialogProps) {
  useSourcesChangedSync();
  const { config } = useKnowledgeConfig();
  const uploads = useUploads();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const add = (files: FileList | File[] | null) => {
    if (!files || !files.length) return;
    enqueue(Array.from(files), config);
  };

  const active = uploads.filter((u) => u.phase === "uploading" || u.phase === "indexing").length;
  const finished = uploads.length - active;
  const close = () => onOpenChange(false);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Upload documents"
      description="wuup answers from your files with numbered citations."
      size="md"
      className="sm:max-w-[560px]!"
      footer={
        <>
          <p className="text-[13px] text-tx-tertiary sm:mr-auto sm:self-center" aria-live="polite">
            {active > 0
              ? `${active} in progress. You can close this, uploads keep going.`
              : uploads.length > 0
                ? "All done."
                : ""}
          </p>
          {finished > 0 && active === 0 ? (
            <Button variant="soft" onClick={clearFinished}>
              Clear list
            </Button>
          ) : null}
          <Button variant="ink" onClick={close}>
            {uploads.length > 0 && active === 0 ? "Done" : "Close"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4" data-testid="upload-dialog">
        <div
          role="button"
          tabIndex={0}
          aria-label="Choose files to upload, or drop them here"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            dragDepth.current += 1;
            setDragging(true);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => {
            dragDepth.current = Math.max(0, dragDepth.current - 1);
            if (dragDepth.current === 0) setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            dragDepth.current = 0;
            setDragging(false);
            add(e.dataTransfer.files);
          }}
          data-dragging={dragging || undefined}
          className={cn(
            "group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-[1.5px] border-dashed px-6 py-10 text-center",
            "transition-[border-color,background-color] duration-200 ease-standard",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400",
            dragging ? "border-indigo-300 bg-indigo-50" : "border-st bg-[#fafafa] hover:border-tx-muted hover:bg-sf-secondary/70",
          )}
          data-testid="dropzone"
        >
          <span
            aria-hidden="true"
            className={cn(
              "grid size-12 place-items-center rounded-2xl bg-sf-white text-tx-tertiary shadow-[0_1px_2px_rgba(0,0,0,0.04),inset_0_0_0_1px_#f0f0f0]",
              "transition-[translate,color] duration-300 ease-standard group-hover:-translate-y-0.5",
              dragging && "-translate-y-0.5 text-indigo-600",
            )}
          >
            <Upload className="size-5" strokeWidth={1.5} />
          </span>
          <p className="mt-4 text-[16px] font-medium text-tx">{dragging ? "Drop to upload" : "Drop files here or browse"}</p>
          <p className="mt-1 text-[14px] text-tx-tertiary" data-testid="upload-formats">
            {formatsLabel(config)}, up to {config.maxFileMb} MB
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={acceptAttr(config)}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            data-testid="file-input"
            onChange={(e) => {
              add(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {uploads.length > 0 ? (
          <ul className="flex flex-col gap-2" aria-label="Uploads">
            {uploads.map((u) => (
              <UploadRow key={u.key} item={u} onNavigate={close} />
            ))}
          </ul>
        ) : (
          <p className="flex items-start gap-2 px-1 text-[13px] leading-5 text-tx-tertiary">
            <CircleAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            Files go into your private knowledge base. Delete them any time.
          </p>
        )}
      </div>
    </Dialog>
  );
}

export { UploadDialog };
