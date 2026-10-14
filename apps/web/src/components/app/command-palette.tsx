"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { defaultFilter } from "cmdk";
import {
  Database,
  FileUp,
  Gauge,
  MessageSquare,
  MessageSquarePlus,
  Plug,
  Settings,
  Telescope,
} from "lucide-react";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { ChatSummary, Page } from "@/lib/types";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useAppUI } from "./app-ui-provider";
import { flattenChats, toChatPage, type ChatsList } from "./chat-cache";
import { APP_ROUTES, SETTINGS_NAV } from "./nav";

const SEP = "\u0000";

/** cmdk filter that ignores the hidden id suffix in item values. */
function filter(value: string, search: string, keywords?: string[]) {
  const label = value.split(SEP)[0];
  if (value.startsWith(`server${SEP}`)) return 1;
  return defaultFilter ? defaultFilter(label, search, keywords) : label.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Wraps matches of `q` in <mark>. */
export function Highlight({ text, q }: { text: string; q: string }) {
  const terms = q
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 1)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!terms.length) return <>{text}</>;
  const re = new RegExp(`(${terms.join("|")})`, "gi");
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded-[3px] bg-indigo-100 px-px text-indigo-800">
            {p}
          </mark>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  );
}

export default function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { openDialog } = useAppUI();
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search.trim(), 200);

  // Reset the query each time the palette opens.
  const [prevOpen, setPrevOpen] = React.useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) setSearch("");
  }

  const cached = React.useMemo(
    () => (open ? flattenChats(qc.getQueryData<ChatsList>(qk.chats.list)) : []),
    [open, qc],
  );

  const server = useQuery({
    queryKey: qk.chats.search(q),
    queryFn: ({ signal }) =>
      api<Page<ChatSummary> | ChatSummary[]>("/chats", { signal, query: { q, limit: 20 } }).then(toChatPage),
    enabled: open && q.length >= 2,
    staleTime: 30_000,
  });

  const cachedIds = React.useMemo(() => new Set(cached.map((c) => c.id)), [cached]);
  const serverOnly = React.useMemo(
    () =>
      (server.data?.items ?? []).filter(
        (c) => !cachedIds.has(c.id) || (c.match?.messageId != null && c.match.snippet !== c.title),
      ),
    [server.data, cachedIds],
  );
  const serverIds = React.useMemo(() => new Set(serverOnly.map((c) => c.id)), [serverOnly]);

  const run = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };
  const go = (href: string) => run(() => router.push(href));

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      label="Search and commands"
      commandProps={{ filter }}
    >
      <CommandInput value={search} onValueChange={setSearch} placeholder="Search chats or jump to..." />
      <CommandList>
        {serverOnly.length === 0 ? (
          <CommandEmpty>{server.isFetching ? "Searching your chats..." : "No matches. Try other words."}</CommandEmpty>
        ) : null}

        <CommandGroup heading="Actions">
          <CommandItem icon={<MessageSquarePlus />} value={`New chat${SEP}a1`} shortcut="⌘⇧O" onSelect={() => go(APP_ROUTES.newChat)}>
            New chat
          </CommandItem>
          <CommandItem
            icon={<Plug />}
            value={`Connect data${SEP}a2`}
            keywords={["mongodb", "sheets", "database", "bridge"]}
            onSelect={() => run(() => openDialog("connect"))}
          >
            Connect data
          </CommandItem>
          <CommandItem
            icon={<FileUp />}
            value={`Upload a document${SEP}a3`}
            keywords={["pdf", "file", "knowledge"]}
            onSelect={() => run(() => openDialog("upload"))}
          >
            Upload a document
          </CommandItem>
          <CommandItem
            icon={<Telescope />}
            value={`Toggle research mode${SEP}a4`}
            keywords={["deep", "report"]}
            onSelect={() => run(() => window.dispatchEvent(new CustomEvent("wuup:toggle-research")))}
          >
            Toggle research mode
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Go to">
          <CommandItem icon={<Database />} value={`Data sources${SEP}g1`} onSelect={() => go(APP_ROUTES.data)}>
            Data sources
          </CommandItem>
          {SETTINGS_NAV.filter((s) => s.href !== APP_ROUTES.usage).map((s) => (
            <CommandItem
              key={s.href}
              icon={<Settings />}
              value={`Settings: ${s.label}${SEP}${s.href}`}
              keywords={[s.description]}
              onSelect={() => go(s.href)}
            >
              Settings: {s.label}
            </CommandItem>
          ))}
          <CommandItem icon={<Gauge />} value={`Usage & plan${SEP}g9`} keywords={["billing", "free", "quota"]} onSelect={() => go(APP_ROUTES.usage)}>
            Usage &amp; plan
          </CommandItem>
        </CommandGroup>

        {cached.length > 0 ? (
          <CommandGroup heading="Chats">
            {cached
              .filter((c) => !serverIds.has(c.id))
              .slice(0, search ? 50 : 8)
              .map((c) => (
                <CommandItem
                  key={c.id}
                  icon={<MessageSquare />}
                  value={`${c.title}${SEP}${c.id}`}
                  onSelect={() => go(APP_ROUTES.chat(c.id))}
                >
                  <Highlight text={c.title} q={search} />
                </CommandItem>
              ))}
          </CommandGroup>
        ) : null}

        {q.length >= 2 && serverOnly.length > 0 ? (
          <CommandGroup heading="Found in messages" forceMount>
            {serverOnly.map((c) => (
              <CommandItem
                key={c.id}
                forceMount
                icon={<MessageSquare />}
                value={`server${SEP}${c.id}`}
                description={
                  c.match?.snippet && c.match.snippet !== c.title ? <Highlight text={c.match.snippet} q={q} /> : undefined
                }
                onSelect={() => go(APP_ROUTES.chat(c.id))}
              >
                <Highlight text={c.title} q={q} />
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
