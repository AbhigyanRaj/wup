"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, FileText, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KnowledgeSource {
  _id: string;
  name: string;
  status: "pending" | "indexing" | "indexed" | "error" | "error_quota";
  chunkCount: number;
  fileSize: number;
  createdAt: string;
  metadata?: { errorMessage?: string; truncated?: boolean };
}

interface UploadFile {
  file: File;
  progress: number;
  status: "uploading" | "indexing" | "indexed" | "error";
  sourceId?: string;
  errorMessage?: string;
}

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSourcesChanged: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function uploadFile(
  file: File,
  token: string,
  onProgress: (pct: number) => void
): Promise<{ sourceId: string }> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status === 202) resolve(JSON.parse(xhr.responseText));
      else {
        const body = JSON.parse(xhr.responseText || "{}");
        reject(new Error(body.error || `Upload failed (${xhr.status})`));
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Network error.")));
    xhr.open("POST", `${API_URL}/knowledge/upload`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.send(form);
  });
}

async function pollStatus(
  sourceId: string, token: string,
  onUpdate: (status: string, msg?: string) => void
) {
  let interval = 1500;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, interval));
    interval = Math.min(interval * 1.5, 15000);
    try {
      const res = await fetch(`${API_URL}/knowledge/${sourceId}/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data.status === "indexed") { onUpdate("indexed"); return; }
      if (data.status === "error" || data.status === "error_quota") {
        onUpdate("error", data.errorMessage); return;
      }
      onUpdate("indexing");
    } catch { /* network blip */ }
  }
  onUpdate("error", "Indexing timed out. Please re-upload.");
}

// ─── Component ────────────────────────────────────────────────────────────────

export function UploadModal({ isOpen, onClose, onSourcesChanged }: UploadModalProps) {
  const [dragging, setDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!isOpen) setTimeout(() => setUploads([]), 400); }, [isOpen]);

  const processFiles = useCallback(async (files: File[]) => {
    const token = localStorage.getItem("wup_token") || "";
    const valid = files.filter((f) => f.type === "application/pdf" || f.type === "text/plain");
    if (!valid.length) return;

    const base = uploads.length;
    setUploads((prev) => [
      ...prev,
      ...valid.map((f) => ({ file: f, progress: 0, status: "uploading" as const })),
    ]);

    valid.forEach(async (file, idx) => {
      const i = base + idx;
      const patch = (p: Partial<UploadFile>) =>
        setUploads((prev) => prev.map((u, j) => (j === i ? { ...u, ...p } : u)));

      try {
        const { sourceId } = await uploadFile(file, token, (pct) => patch({ progress: pct }));
        patch({ status: "indexing", sourceId, progress: 100 });
        onSourcesChanged();
        await pollStatus(sourceId, token, (status, errorMessage) => {
          patch({ status: status === "indexed" ? "indexed" : "error", errorMessage });
          if (status === "indexed") onSourcesChanged();
        });
      } catch (err: unknown) {
        patch({ status: "error", errorMessage: err instanceof Error ? err.message : "Upload failed." });
      }
    });
  }, [uploads.length, onSourcesChanged]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    processFiles(Array.from(e.dataTransfer.files));
  }, [processFiles]);

  const allDone = uploads.length > 0 && uploads.every((u) => u.status === "indexed" || u.status === "error");

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50"
            style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed z-50 inset-0 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="w-full max-w-sm pointer-events-auto rounded-2xl overflow-hidden"
              style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Upload documents</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>PDF · TXT · up to 20 MB</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"}
                >
                  <X size={15} />
                </button>
              </div>

              {/* Drop zone */}
              <div className="p-4">
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2.5 rounded-xl p-8 cursor-pointer transition-all duration-200"
                  style={{
                    border: `1.5px dashed ${dragging ? "var(--accent)" : "var(--border)"}`,
                    background: dragging ? "var(--accent-dim)" : "rgba(255,255,255,0.02)",
                  }}
                >
                  <div className="p-2.5 rounded-xl" style={{ background: dragging ? "var(--accent-dim)" : "rgba(255,255,255,0.05)" }}>
                    <Upload size={18} style={{ color: dragging ? "var(--accent)" : "var(--text-muted)" }} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm" style={{ color: dragging ? "var(--text-primary)" : "var(--text-secondary)" }}>
                      {dragging ? "Drop to upload" : "Drop files or click to browse"}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>PDF and TXT supported</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file" accept=".pdf,.txt,application/pdf,text/plain" multiple
                    onChange={(e) => { processFiles(Array.from(e.target.files || [])); e.target.value = ""; }}
                    className="hidden"
                  />
                </div>
              </div>

              {/* File list */}
              <AnimatePresence>
                {uploads.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="px-4 pb-2 space-y-1.5 max-h-52 overflow-y-auto"
                  >
                    {uploads.map((u, i) => (
                      <motion.div
                        key={`${u.file.name}-${i}`}
                        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}
                      >
                        <FileText size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12.5px] font-medium truncate" style={{ color: "var(--text-secondary)" }}>
                            {u.file.name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{formatBytes(u.file.size)}</p>
                            {u.status === "uploading" && (
                              <p className="text-[10px]" style={{ color: "var(--blue)" }}>Uploading {u.progress}%</p>
                            )}
                            {u.status === "indexing" && (
                              <p className="text-[10px]" style={{ color: "var(--amber)" }}>Indexing…</p>
                            )}
                            {u.status === "indexed" && (
                              <p className="text-[10px]" style={{ color: "var(--green)" }}>Ready</p>
                            )}
                            {u.status === "error" && (
                              <p className="text-[10px] truncate" style={{ color: "var(--red)" }}>
                                {u.errorMessage || "Failed"}
                              </p>
                            )}
                          </div>
                          {u.status === "uploading" && (
                            <div className="mt-1.5 h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                              <motion.div
                                className="h-full rounded-full"
                                style={{ background: "var(--blue)" }}
                                animate={{ width: `${u.progress}%` }}
                                transition={{ duration: 0.3 }}
                              />
                            </div>
                          )}
                        </div>
                        {u.status === "uploading" && <Loader2 size={13} className="animate-spin shrink-0" style={{ color: "var(--blue)" }} />}
                        {u.status === "indexing" && <Loader2 size={13} className="animate-spin shrink-0" style={{ color: "var(--amber)" }} />}
                        {u.status === "indexed" && <CheckCircle size={13} className="shrink-0" style={{ color: "var(--green)" }} />}
                        {u.status === "error" && <AlertCircle size={13} className="shrink-0" style={{ color: "var(--red)" }} />}
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-3.5" style={{ borderTop: "1px solid var(--border)" }}>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {allDone ? "All done" : uploads.length > 0 ? "Processing…" : ""}
                </p>
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.09)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"}
                >
                  {allDone ? "Done" : "Close"}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
