"use client";

import * as React from "react";
import { Check, ChevronDown, Database, FileUp, Layers, Plug, Plus, Sheet, Telescope } from "lucide-react";
import { MenuContent, MenuItem, MenuLabel, MenuRoot, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TooltipContent, TooltipRoot, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useAppUI } from "@/components/app/app-ui-provider";
import { PROVIDER_LABEL } from "@/components/app/shell/usage-meter";
import { useBridges } from "@/hooks/data/useBridges";
import type { BridgeSummary, ModelOption } from "@/lib/types";
import { cn } from "@/lib/cn";

/* Small pieces of the composer toolbar. */

export const toolChip =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] leading-none " +
  "transition-[background-color,border-color,color] duration-200 ease-standard " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 disabled:pointer-events-none disabled:opacity-50";

export const toolChipOff = "border-transparent text-tx-tertiary hover:bg-sf-secondary hover:text-tx";
export const toolChipOn = "border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100";

// ─── Attach ──────────────────────────────────────────────────────────────────

export function AttachMenu() {
  const ui = useAppUI();
  return (
    <MenuRoot>
      <TooltipRoot delayDuration={400}>
        <TooltipTrigger asChild>
          <MenuTrigger asChild>
            <button
              type="button"
              aria-label="Add data"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-st text-tx-secondary transition-colors duration-200 ease-standard hover:bg-sf-secondary hover:text-tx focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 data-[state=open]:bg-sf-secondary"
            >
              <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </MenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">Add data</TooltipContent>
      </TooltipRoot>
      <MenuContent side="top" align="start">
        <MenuItem icon={<FileUp />} onSelect={() => ui.openDialog("upload")}>
          Upload a document
        </MenuItem>
        <MenuItem icon={<Plug />} onSelect={() => ui.openDialog("connect")}>
          Connect data
        </MenuItem>
      </MenuContent>
    </MenuRoot>
  );
}

// ─── Scope ───────────────────────────────────────────────────────────────────

function bridgeIcon(b: BridgeSummary) {
  return b.type === "sheets" ? Sheet : Database;
}

export function scopeLabel(bridges: BridgeSummary[] | undefined, ids: string[]) {
  if (!ids.length) return "All data";
  const names = ids.map((id) => bridges?.find((b) => b.id === id)?.name).filter(Boolean) as string[];
  if (!names.length) return `${ids.length} selected`;
  return names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`;
}

export function ScopePicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { data: bridges, isLoading } = useBridges();
  const ui = useAppUI();
  const label = scopeLabel(bridges, value);
  const scoped = value.length > 0;

  const toggle = (id: string, on: boolean) => {
    const all = bridges?.map((b) => b.id) ?? [];
    const base = value.length ? value : all;
    let next = on ? Array.from(new Set([...base, id])) : base.filter((x) => x !== id);
    // Everything selected is the same as no scope.
    if (all.length && next.length === all.length) next = [];
    if (!next.length && !on) return; // keep at least one
    onChange(next);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Data scope: ${label}`}
          className={cn(toolChip, scoped ? toolChipOn : toolChipOff, "max-w-[160px] data-[state=open]:bg-sf-secondary")}
        >
          <Layers className="size-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          <span className="truncate">{label}</span>
          <ChevronDown className="size-3 shrink-0 opacity-60" strokeWidth={1.5} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-[300px] p-0">
        <div className="border-b border-st-secondary px-4 py-3">
          <p className="text-[14px] font-medium text-tx">Answer from</p>
          <p className="text-[12px] text-tx-tertiary">Pick which connections this chat may query. Documents are always searched.</p>
        </div>
        {isLoading ? (
          <p className="px-4 py-3 text-[13px] text-tx-tertiary">Loading connections</p>
        ) : bridges?.length ? (
          <ul className="max-h-64 overflow-y-auto p-2">
            {bridges.map((b) => {
              const Icon = bridgeIcon(b);
              const checked = !value.length || value.includes(b.id);
              return (
                <li key={b.id} className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-bg">
                  <Checkbox
                    id={`scope-${b.id}`}
                    checked={checked}
                    onCheckedChange={(v) => toggle(b.id, v === true)}
                    aria-label={b.name}
                  />
                  <label htmlFor={`scope-${b.id}`} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-[14px] text-tx-secondary">
                    <Icon className="size-3.5 shrink-0 text-tx-tertiary" strokeWidth={1.5} aria-hidden="true" />
                    <span className="truncate">{b.name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="px-4 py-4">
            <p className="text-[13px] text-tx-tertiary">No databases or sheets connected yet.</p>
            <Button variant="soft" size="sm" className="mt-3" onClick={() => ui.openDialog("connect")}>
              Connect data
            </Button>
          </div>
        )}
        {value.length && bridges?.length ? (
          <div className="border-t border-st-secondary px-2 py-2">
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full rounded-lg px-2 py-1.5 text-left text-[13px] text-indigo-700 hover:bg-bg focus-visible:outline-2 focus-visible:outline-indigo-400"
            >
              Use all data
            </button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

// ─── Model ───────────────────────────────────────────────────────────────────

/** The API labels models; older servers send the raw id ("meta-llama/llama-4-scout"), so tidy those. */
function modelLabel(m: ModelOption) {
  if (m.label && m.label !== m.id) return m.label;
  const base = m.id.split("/").pop() ?? m.id;
  return base
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => (/^\d/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

function isExhausted(m: ModelOption) {
  if (!m.available) return true;
  return !!m.cooldownUntil && Date.parse(m.cooldownUntil) > Date.now();
}

export function ModelPicker({
  models,
  value,
  onChange,
}: {
  models: ModelOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  const current = models.find((m) => m.id === value);
  const label = value === "auto" || !current ? "Auto" : modelLabel(current);
  const provider = models.find((m) => m.id !== "auto")?.provider ?? models[0]?.provider;
  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={`Model: ${label}`}
          className={cn(toolChip, toolChipOff, "max-w-[150px] data-[state=open]:bg-sf-secondary")}
        >
          <Telescope className="size-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          <span className="truncate">{label}</span>
          <ChevronDown className="size-3 shrink-0 opacity-60" strokeWidth={1.5} aria-hidden="true" />
        </button>
      </MenuTrigger>
      <MenuContent side="top" align="end" className="min-w-[240px]">
        <MenuLabel className="flex items-center justify-between gap-3">
          <span>Model</span>
          {provider ? <span className="normal-case tracking-normal text-tx-muted">{PROVIDER_LABEL[provider]}</span> : null}
        </MenuLabel>
        {(models.length ? models : [{ id: "auto", label: "Auto", provider: "gemini", available: true, cooldownUntil: null } as ModelOption]).map(
          (m, i) => {
            const exhausted = m.id !== "auto" && isExhausted(m);
            const selected = m.id === value || (value === "auto" && m.id === "auto");
            return (
              <React.Fragment key={m.id}>
                {i === 1 ? <MenuSeparator /> : null}
                <MenuItem disabled={exhausted} onSelect={() => onChange(m.id)}>
                  <span className="flex w-full items-center gap-2">
                    <span className="min-w-0 flex-1 truncate">
                      {m.id === "auto" ? "Auto" : modelLabel(m)}
                      {m.id === "auto" ? (
                        <span className="ml-1.5 text-[12px] text-tx-muted">best available</span>
                      ) : null}
                    </span>
                    {exhausted ? (
                      <span className="pill pill--warning shrink-0 text-[11px]">Limit reached</span>
                    ) : selected ? (
                      <Check className="size-4 shrink-0 text-indigo-600" strokeWidth={2} aria-hidden="true" />
                    ) : null}
                  </span>
                </MenuItem>
              </React.Fragment>
            );
          },
        )}
      </MenuContent>
    </MenuRoot>
  );
}
