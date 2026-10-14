"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Ellipsis, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import { MenuContent, MenuItem, MenuRoot, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { useAppUI } from "@/components/app/app-ui-provider";
import { buildUrl } from "@/lib/api";
import { getToken } from "@/lib/auth-token";
import { qk } from "@/lib/query-keys";
import type { ChatSummary } from "@/lib/types";
import { chatToMarkdown, downloadText, slugify } from "@/lib/export/markdown";
import { streamStore } from "@/lib/stream-store";
import { useDeleteChat, useUpdateChatMeta } from "@/hooks/data/useChats";
import type { MessagesData } from "@/hooks/data/useMessages";

/* Top bar actions for an open chat: Export, and More (Rename, Pin, Delete). */

async function exportChat(chat: ChatSummary, cached: MessagesData | undefined) {
  const filename = `${slugify(chat.title)}.md`;
  try {
    const headers = new Headers({ Accept: "text/markdown" });
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(buildUrl(`/chats/${encodeURIComponent(chat.id)}/export`, { format: "md" }), {
      credentials: "include",
      headers,
    });
    if (res.ok) {
      downloadText(filename, await res.text());
      return;
    }
  } catch {
    /* fall back to the client export */
  }
  if (!cached?.items.length) throw new Error("Nothing to export yet.");
  downloadText(filename, chatToMarkdown(chat.title, cached.items));
}

function RenameDialog({
  open,
  onOpenChange,
  chat,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  chat: ChatSummary;
}) {
  const [title, setTitle] = React.useState(chat.title);
  const rename = useUpdateChatMeta();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const formId = React.useId();

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Rename chat"
      size="sm"
      initialFocusRef={inputRef}
      footer={
        <>
          <Button variant="soft" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={!title.trim()}>
            Save
          </Button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={(e) => {
          e.preventDefault();
          const t = title.trim();
          if (!t) return;
          if (t !== chat.title) rename.mutate({ id: chat.id, patch: { title: t } });
          onOpenChange(false);
        }}
      >
        <label htmlFor={`${formId}-title`} className="sr-only">
          Chat title
        </label>
        <Input
          id={`${formId}-title`}
          ref={inputRef}
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
        />
      </form>
    </Dialog>
  );
}

export function ChatTopActions({ chat }: { chat: ChatSummary }) {
  const qc = useQueryClient();
  const router = useRouter();
  const ui = useAppUI();
  const update = useUpdateChatMeta();
  const del = useDeleteChat();
  const [renaming, setRenaming] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  const onExport = async () => {
    setExporting(true);
    try {
      await exportChat(chat, qc.getQueryData<MessagesData>(qk.messages(chat.id)));
    } catch (e) {
      toast.error("Couldn't export this chat", { description: (e as Error).message });
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Button
          variant="ghost"
          size="sm"
          onClick={onExport}
          disabled={exporting}
          leadingIcon={<Download className="size-4" strokeWidth={1.5} aria-hidden="true" />}
          className="max-sm:hidden"
        >
          Export
        </Button>
      <MenuRoot>
        <MenuTrigger asChild>
          <button
            type="button"
            aria-label="More chat actions"
            className="icon-btn icon-btn--ghost data-[state=open]:bg-sf-secondary"
          >
            <Ellipsis strokeWidth={1.5} />
          </button>
        </MenuTrigger>
        <MenuContent align="end">
          <MenuItem icon={<Download />} onSelect={onExport} className="sm:hidden">
            Export as Markdown
          </MenuItem>
          <MenuItem icon={<Pencil />} onSelect={() => setRenaming(true)}>
            Rename
          </MenuItem>
          <MenuItem
            icon={chat.pinned ? <PinOff /> : <Pin />}
            onSelect={() => update.mutate({ id: chat.id, patch: { pinned: !chat.pinned } })}
          >
            {chat.pinned ? "Unpin" : "Pin"}
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            icon={<Trash2 />}
            tone="danger"
            onSelect={() =>
              ui.openConfirm({
                title: "Delete this chat?",
                body: `"${chat.title}" and its answers will be deleted. This can't be undone.`,
                confirmLabel: "Delete",
                tone: "danger",
                onConfirm: async () => {
                  streamStore.stop(chat.id);
                  await del.mutateAsync(chat.id);
                  router.replace("/chat");
                },
              })
            }
          >
            Delete
          </MenuItem>
        </MenuContent>
      </MenuRoot>
      {renaming ? <RenameDialog open={renaming} onOpenChange={setRenaming} chat={chat} /> : null}
    </>
  );
}
