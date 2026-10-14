/**
 * Upload queue that lives outside React, so closing the upload dialog (or
 * leaving the page) never loses progress. Components read it with
 * `useUploads()`; anything that changes the server list calls the
 * `onSourcesChanged` hook registered by the data hooks.
 *
 * Phases:
 *   uploading  XHR in flight (progress 0..1)
 *   indexing   server status pending | indexing (chunk progress when known)
 *   ready      indexed
 *   failed     error | error_quota, a rejected file, or a failed upload
 *   duplicate  409: the same file is already in the knowledge base
 * A slow index is never "failed": after a while the row says "Still indexing.
 * We'll keep checking." and polling continues at a slower pace.
 */

import { useSyncExternalStore } from "react";
import { ApiError, apiUpload, errorMessage } from "@/lib/api";
import type { KnowledgeConfig, KnowledgeSourceDTO, UploadResponse } from "@/lib/types";
import { knowledgeApi, normalizeSource, validateFile, phaseFor, failureMessage } from "@/lib/knowledge";

export type UploadPhase = "uploading" | "indexing" | "ready" | "failed" | "duplicate";

export interface UploadItem {
  key: string;
  name: string;
  size: number;
  phase: UploadPhase;
  /** Upload fraction 0..1 while uploading. */
  progress: number;
  /** Chunk progress while indexing. */
  chunks: { done: number; total: number } | null;
  sourceId?: string;
  error?: string;
  /** Indexing is taking longer than usual (never shown as failed). */
  slow: boolean;
  /** Whether Retry is offered. */
  canRetry: boolean;
}

interface Internal {
  file: File;
  abort?: AbortController;
  pollToken: number;
}

let items: UploadItem[] = [];
const internals = new Map<string, Internal>();
const listeners = new Set<() => void>();
let changedHook: (() => void) | null = null;
let seq = 0;

/** Poll timings. Exported for tests. */
export const POLL = { firstMs: 1200, maxMs: 6000, slowAfterMs: 90_000, slowMs: 15_000 };

function emit() {
  for (const l of listeners) l();
}

function patch(key: string, p: Partial<UploadItem>) {
  items = items.map((it) => (it.key === key ? { ...it, ...p } : it));
  emit();
}

function notifyChanged() {
  try {
    changedHook?.();
  } catch {
    /* ignore */
  }
}

/** Lets the data layer invalidate its queries when the queue changes the server list. */
export function setSourcesChangedHook(fn: (() => void) | null) {
  changedHook = fn;
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function getUploads(): UploadItem[] {
  return items;
}

const EMPTY: UploadItem[] = [];

export function useUploads(): UploadItem[] {
  return useSyncExternalStore(subscribe, getUploads, () => EMPTY);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function applySource(key: string, src: KnowledgeSourceDTO) {
  const phase = phaseFor(src.status);
  if (phase === "ready") {
    patch(key, { phase: "ready", chunks: null, slow: false, error: undefined, canRetry: false });
  } else if (phase === "failed") {
    patch(key, { phase: "failed", error: failureMessage(src), canRetry: src.canRetry !== false, slow: false });
  } else {
    patch(key, { phase: "indexing", chunks: src.progress ?? null });
  }
  return phase;
}

async function poll(key: string, sourceId: string) {
  const internal = internals.get(key);
  if (!internal) return;
  const token = ++internal.pollToken;
  const started = Date.now();
  let delay = POLL.firstMs;
  for (;;) {
    await sleep(delay);
    const cur = internals.get(key);
    if (!cur || cur.pollToken !== token) return; // dismissed or superseded
    try {
      const src = await knowledgeApi.get(sourceId);
      const phase = applySource(key, src);
      if (phase !== "indexing") {
        notifyChanged();
        return;
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        // Deleted elsewhere: drop the row quietly.
        dismiss(key);
        return;
      }
      /* network blip: keep checking */
    }
    if (Date.now() - started > POLL.slowAfterMs) {
      if (!items.find((i) => i.key === key)?.slow) patch(key, { slow: true });
      delay = POLL.slowMs;
    } else {
      delay = Math.min(Math.round(delay * 1.4), POLL.maxMs);
    }
  }
}

async function run(key: string) {
  const internal = internals.get(key);
  if (!internal) return;
  internal.abort = new AbortController();
  patch(key, { phase: "uploading", progress: 0, error: undefined, slow: false, canRetry: false });
  const form = new FormData();
  form.append("file", internal.file);
  try {
    const res = await apiUpload<UploadResponse | KnowledgeSourceDTO>(
      "/knowledge/upload",
      form,
      (f) => patch(key, { progress: f }),
      { signal: internal.abort.signal },
    );
    const r = res as Partial<UploadResponse> & Record<string, unknown>;
    const src = r.source
      ? normalizeSource(r.source)
      : r.sourceId
        ? normalizeSource({
            id: r.sourceId,
            _id: r.sourceId,
            name: (r.name as string) ?? internal.file.name,
            status: r.status ?? "pending",
          } as KnowledgeSourceDTO)
        : normalizeSource(res as KnowledgeSourceDTO);
    patch(key, { sourceId: src.id, progress: 1 });
    notifyChanged();
    const phase = applySource(key, src);
    if (phase === "indexing") void poll(key, src.id);
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return;
    if (e instanceof ApiError && (e.status === 409 || e.code === "CONFLICT")) {
      patch(key, { phase: "duplicate", error: undefined, canRetry: false });
      return;
    }
    const retryable = !(e instanceof ApiError) || e.status === 0 || e.status >= 500 || e.status === 429;
    patch(key, {
      phase: "failed",
      error:
        e instanceof ApiError && e.code === "UNSUPPORTED_FILE"
          ? "This file type isn't supported."
          : errorMessage(e, "Upload failed."),
      canRetry: retryable,
    });
  }
}

/** Queues files. Files that fail validation show up as failed rows right away. */
export function enqueue(files: File[], cfg: KnowledgeConfig) {
  const added: UploadItem[] = [];
  const toRun: string[] = [];
  for (const file of files) {
    const key = `u${++seq}`;
    const problem = validateFile(file, cfg);
    internals.set(key, { file, pollToken: 0 });
    added.push({
      key,
      name: file.name,
      size: file.size,
      phase: problem ? "failed" : "uploading",
      progress: 0,
      chunks: null,
      error: problem ?? undefined,
      slow: false,
      canRetry: false,
    });
    if (!problem) toRun.push(key);
  }
  items = [...added.reverse(), ...items];
  emit();
  for (const key of toRun) void run(key);
}

/** Retries a failed row: server-side retry when the source exists, else a re-upload. */
export async function retry(key: string) {
  const item = items.find((i) => i.key === key);
  if (!item) return;
  if (item.sourceId) {
    patch(key, { phase: "indexing", error: undefined, chunks: null, slow: false, canRetry: false });
    try {
      const src = await knowledgeApi.retry(item.sourceId);
      if (src) applySource(key, src);
      notifyChanged();
      void poll(key, item.sourceId);
    } catch (e) {
      patch(key, { phase: "failed", error: errorMessage(e, "Retry failed."), canRetry: true });
    }
    return;
  }
  void run(key);
}

/** Removes a row (cancelling its upload or poll). */
export function dismiss(key: string) {
  const internal = internals.get(key);
  internal?.abort?.abort();
  internals.delete(key);
  items = items.filter((i) => i.key !== key);
  emit();
}

/** Clears finished rows (ready, failed, duplicate). */
export function clearFinished() {
  for (const it of items) {
    if (it.phase === "ready" || it.phase === "failed" || it.phase === "duplicate") internals.delete(it.key);
  }
  items = items.filter((i) => i.phase === "uploading" || i.phase === "indexing");
  emit();
}

/** Test-only reset. */
export function __resetUploads() {
  for (const i of internals.values()) i.abort?.abort();
  internals.clear();
  items = [];
  emit();
}
