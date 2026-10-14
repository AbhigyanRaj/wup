"use client";

import type { ReactNode } from "react";
import { Check, Download } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from "@/components/ui/menu";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/toast";
import { useFlash } from "./hooks";

/* Icon actions for renderer cards: a tooltip'd IconButton and a download menu. */

export function ActionIcon({
  label,
  onClick,
  children,
  pressed,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  pressed?: boolean;
}) {
  return (
    <Tooltip content={label}>
      <IconButton aria-label={label} aria-pressed={pressed} size="sm" onClick={onClick} className="text-tx-tertiary hover:text-tx">
        {children}
      </IconButton>
    </Tooltip>
  );
}

/** Copy action whose icon turns into a check for a moment. */
export function CopyAction({
  label,
  doneLabel = "Copied",
  icon,
  getText,
  copy,
}: {
  label: string;
  doneLabel?: string;
  icon: ReactNode;
  getText: () => string;
  copy: (text: string) => Promise<boolean>;
}) {
  const [done, flash] = useFlash();
  return (
    <ActionIcon
      label={done ? doneLabel : label}
      onClick={async () => {
        const ok = await copy(getText());
        if (ok) {
          flash();
          toast.success(doneLabel);
        } else {
          toast.error("Copy failed. Your browser blocked the clipboard");
        }
      }}
    >
      {done ? <Check aria-hidden="true" strokeWidth={1.5} /> : icon}
    </ActionIcon>
  );
}

export interface ExportItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void | Promise<void>;
}

export function ExportMenu({ items, label = "Download" }: { items: ExportItem[]; label?: string }) {
  return (
    <MenuRoot modal={false}>
      <Tooltip content={label}>
        <MenuTrigger asChild>
          <IconButton aria-label={label} size="sm" className="text-tx-tertiary hover:text-tx data-[state=open]:bg-sf-secondary data-[state=open]:text-tx">
            <Download aria-hidden="true" strokeWidth={1.5} />
          </IconButton>
        </MenuTrigger>
      </Tooltip>
      <MenuContent align="end" className="min-w-[184px]">
        {items.map((item) => (
          <MenuItem
            key={item.label}
            icon={item.icon}
            onSelect={() => {
              Promise.resolve(item.onSelect()).catch((err: unknown) => {
                toast.error("Export failed", {
                  description: err instanceof Error ? err.message : undefined,
                });
              });
            }}
          >
            {item.label}
          </MenuItem>
        ))}
      </MenuContent>
    </MenuRoot>
  );
}
