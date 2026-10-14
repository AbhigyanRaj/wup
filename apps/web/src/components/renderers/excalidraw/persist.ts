"use client";

import { createContext, useContext } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { DiagramEdit, MessageDTO, SaveDiagramBody, SaveDiagramResponse } from "@wup/contracts";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { DiagramScene } from "./types";

/*
 * Saved diagram edits. Light module (ships with chat): the API calls and the
 * TanStack cache patch for qk.messages(chatId).
 *
 * The assistant message provides { chatId, messageId, edits } through
 * DiagramPersistContext; VisualBlock (key "visual") and MermaidBlock (key
 * "m:<n>") read it. Without it (the /renderers gallery, marketing mocks, the
 * demo sandbox) editing still works, it just isn't saved.
 */

export interface DiagramPersistValue {
  chatId: string;
  messageId: string;
  edits?: Record<string, DiagramEdit>;
  /** False for the demo sandbox: edit locally, never save. */
  persist?: boolean;
}

export const DiagramPersistContext = createContext<DiagramPersistValue | null>(null);

export function useDiagramPersist(): DiagramPersistValue | null {
  return useContext(DiagramPersistContext);
}

export interface DiagramTarget {
  chatId: string;
  messageId: string;
  key: string;
}

function path(t: DiagramTarget) {
  return `/chats/${encodeURIComponent(t.chatId)}/messages/${encodeURIComponent(t.messageId)}/diagrams/${encodeURIComponent(t.key)}`;
}

/** The parts of a scene worth storing: live elements and the images they use. */
export function toSaveBody(scene: DiagramScene): SaveDiagramBody {
  const elements = scene.elements.filter((e) => !e.isDeleted);
  const used = new Set(elements.map((e) => (e.type === "image" ? (e as { fileId?: string | null }).fileId : null)).filter(Boolean));
  const files: NonNullable<SaveDiagramBody["files"]> = {};
  for (const [id, f] of Object.entries(scene.files)) {
    if (!used.has(id)) continue;
    files[id] = { id: f.id, mimeType: f.mimeType, dataURL: f.dataURL, created: f.created };
  }
  return {
    elements: JSON.parse(JSON.stringify(elements)) as SaveDiagramBody["elements"],
    appState: { viewBackgroundColor: "#ffffff" },
    files,
  };
}

export function fromSaved(edit: DiagramEdit): DiagramScene {
  return {
    elements: edit.elements as unknown as DiagramScene["elements"],
    files: edit.files as unknown as DiagramScene["files"],
    image: false,
  };
}

interface MessagesData {
  items: MessageDTO[];
  nextCursor: string | null;
}

/** Patch one message's diagramEdits in the messages cache (null removes the key). */
export function patchEdits(qc: QueryClient | undefined, t: DiagramTarget, edit: DiagramEdit | null) {
  qc?.setQueryData<MessagesData>(qk.messages(t.chatId), (old) => {
    if (!old?.items) return old;
    return {
      ...old,
      items: old.items.map((m) => {
        if (m.id !== t.messageId) return m;
        const next = { ...(m.diagramEdits ?? {}) };
        if (edit) next[t.key] = edit;
        else delete next[t.key];
        return { ...m, diagramEdits: Object.keys(next).length ? next : undefined };
      }),
    };
  });
}

export async function saveDiagram(qc: QueryClient | undefined, t: DiagramTarget, scene: DiagramScene): Promise<DiagramEdit> {
  const body = toSaveBody(scene);
  const res = await api<SaveDiagramResponse>(path(t), { method: "PUT", json: body });
  const edit: DiagramEdit = {
    elements: body.elements,
    appState: body.appState ?? {},
    files: body.files ?? {},
    updatedAt: res.updatedAt,
  };
  patchEdits(qc, t, edit);
  return edit;
}

export async function resetDiagram(qc: QueryClient | undefined, t: DiagramTarget): Promise<void> {
  await api(path(t), { method: "DELETE" });
  patchEdits(qc, t, null);
}
