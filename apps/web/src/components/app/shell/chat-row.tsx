"use client";

import * as React from "react";
import Link from "next/link";
import { MoreHorizontal, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ChatSummary } from "@/lib/types";
import { MenuContent, MenuItem, MenuRoot, MenuSeparator, MenuTrigger } from "@/components/ui/menu";

export interface ChatRowProps {
  chat: ChatSummary;
  active: boolean;
  streaming: boolean;
  onRename: (title: string) => void;
  onTogglePin: () => void;
  onDelete: () => void;
  onNavigate?: () => void;
}

export function ChatRow({ chat, active, streaming, onRename, onTogglePin, onDelete, onNavigate }: ChatRowProps) {
  const [editing, setEditing] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <li className="group/row relative" data-chat-id={chat.id}>
      {editing ? (
        <RenameInput
          initial={chat.title}
          onDone={(title) => {
            setEditing(false);
            if (title && title !== chat.title) onRename(title);
          }}
        />
      ) : (
        <Link
          href={`/chat/${chat.id}`}
          aria-current={active ? "page" : undefined}
          onClick={onNavigate}
          className={cn(
            "flex h-[34px] w-full items-center gap-2 rounded-lg pl-2.5 pr-9 text-[14px] leading-5 outline-none transition-colors duration-150 ease-out",
            "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-400",
            active ? "bg-sf-secondary text-tx" : "text-tx-tertiary hover:bg-sf-secondary/70 hover:text-tx",
            menuOpen && !active && "bg-sf-secondary/70 text-tx",
          )}
        >
          {streaming ? (
            <span className="relative flex size-1.5 shrink-0" aria-hidden="true">
              <span className="absolute inset-0 animate-ping rounded-full bg-blue-600/50 motion-reduce:animate-none" />
              <span className="relative size-1.5 rounded-full bg-blue-600" />
            </span>
          ) : null}
          <span className="min-w-0 flex-1 truncate">{chat.title}</span>
          {streaming ? <span className="sr-only">(answering)</span> : null}
        </Link>
      )}

      {!editing ? (
        <MenuRoot open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
          <MenuTrigger asChild>
            <button
              type="button"
              aria-label={`Options for ${chat.title}`}
              className={cn(
                "absolute right-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-tx-tertiary transition-[opacity,background-color,color] duration-150",
                "hover:bg-sf-tertiary hover:text-tx",
                "focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-indigo-400",
                "pointer-coarse:opacity-100",
                active || menuOpen ? "opacity-100" : "opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100",
              )}
            >
              <MoreHorizontal className="size-4" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </MenuTrigger>
          <MenuContent align="start" side="bottom" className="min-w-[180px]">
            <MenuItem icon={<Pencil />} onSelect={() => setEditing(true)}>
              Rename
            </MenuItem>
            <MenuItem icon={chat.pinned ? <PinOff /> : <Pin />} onSelect={onTogglePin}>
              {chat.pinned ? "Unpin" : "Pin"}
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Trash2 />} tone="danger" onSelect={onDelete}>
              Delete
            </MenuItem>
          </MenuContent>
        </MenuRoot>
      ) : null}
    </li>
  );
}

function RenameInput({ initial, onDone }: { initial: string; onDone: (title: string | null) => void }) {
  const ref = React.useRef<HTMLInputElement>(null);
  const done = React.useRef(false);
  const [value, setValue] = React.useState(initial);

  React.useEffect(() => {
    // Wait a frame so the menu's focus return does not steal focus back.
    const id = requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, []);

  function finish(save: boolean) {
    if (done.current) return;
    done.current = true;
    onDone(save ? value.trim().slice(0, 120) || null : null);
  }

  return (
    <input
      ref={ref}
      value={value}
      aria-label="Chat title"
      maxLength={120}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          finish(true);
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          finish(false);
        }
      }}
      onBlur={() => finish(true)}
      className="h-[34px] w-full rounded-lg border border-indigo-300 bg-sf-white px-2.5 text-[14px] text-tx shadow-focus outline-none"
    />
  );
}
