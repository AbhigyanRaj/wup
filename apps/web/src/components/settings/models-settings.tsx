"use client";

import { useState } from "react";
import { ArrowUpRight, Info, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { ApiError, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { FACTS, shipped } from "@/lib/site";
import type { LlmProvider, ModelOption } from "@/lib/types";
import { useModels } from "@/hooks/data/useModels";
import { useKeys, useRemoveKey, useSaveKey, type ActiveKey } from "@/hooks/data/useKeys";
import { usePreferences } from "@/hooks/data/usePreferences";
import { SettingsCard, SettingsHeader } from "./settings-ui";

export const PROVIDERS: Record<
  LlmProvider,
  {
    name: string;
    maker: string;
    console: string;
    consoleLabel: string;
    placeholder: string;
    tile: string;
    glyph: string;
    /** One short line under the provider name. */
    note?: string;
  }
> = {
  gemini: {
    name: "Gemini",
    maker: "Google",
    console: "https://aistudio.google.com/app/apikey",
    consoleLabel: "Google AI Studio",
    placeholder: "AIza...",
    tile: "linear-gradient(160deg, #5b8def 0%, #a5d8fb 100%)",
    glyph: "G",
  },
  openai: {
    name: "OpenAI",
    maker: "OpenAI",
    console: "https://platform.openai.com/api-keys",
    consoleLabel: "OpenAI Platform",
    placeholder: "sk-...",
    tile: "linear-gradient(160deg, #3a3f5c 0%, #8a90a8 100%)",
    glyph: "O",
  },
  anthropic: {
    name: "Anthropic",
    maker: "Anthropic",
    console: "https://console.anthropic.com/settings/keys",
    consoleLabel: "Anthropic Console",
    placeholder: "sk-ant-...",
    tile: "linear-gradient(160deg, #df9c2a 0%, #f6d79c 100%)",
    glyph: "A",
  },
  openrouter: {
    name: "OpenRouter",
    maker: "Many providers",
    console: "https://openrouter.ai/keys",
    consoleLabel: "OpenRouter",
    placeholder: "sk-or-...",
    tile: "linear-gradient(160deg, #556adc 0%, #c7d2fe 100%)",
    glyph: "R",
  },
  groq: {
    name: "Groq",
    maker: "Groq",
    console: "https://console.groq.com/keys",
    consoleLabel: "GroqCloud",
    placeholder: "gsk_...",
    tile: "linear-gradient(160deg, #e0573c 0%, #f8c3b4 100%)",
    glyph: "Q",
    note: "Very fast open models",
  },
};

const ORDER: LlmProvider[] = ["gemini", "openai", "anthropic", "openrouter", "groq"];

function ProviderTile({ provider, size = "md" }: { provider: LlmProvider; size?: "md" | "sm" }) {
  const p = PROVIDERS[provider];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden font-display text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]",
        size === "md" ? "size-11 rounded-xl text-[22px]" : "size-8 rounded-[10px] text-[16px]",
      )}
      style={{ background: p.tile }}
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.5),transparent_65%)]" />
      <span className="relative">{p.glyph}</span>
    </span>
  );
}

export function ApiKeyDialog({
  provider,
  replacing,
  onOpenChange,
}: {
  provider: LlmProvider | null;
  replacing: ActiveKey | null;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useSaveKey();
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState(provider);
  if (provider !== last) {
    setLast(provider);
    setKey("");
    setError(null);
  }
  const p = provider ? PROVIDERS[provider] : null;

  async function submit() {
    if (!provider) return;
    const k = key.trim();
    if (k.length < 10) return setError("That key looks too short.");
    setError(null);
    try {
      await save.mutateAsync({ provider, apiKey: k });
      toast.success(`${PROVIDERS[provider].name} key saved`, { description: "Your answers now use your own key." });
      onOpenChange(false);
    } catch (e) {
      setError(
        e instanceof ApiError && e.details?.length ? e.details.map((d) => d.message).join(" ") : errorMessage(e, "Couldn't save the key."),
      );
    }
  }

  return (
    <Dialog
      open={!!provider}
      onOpenChange={(o) => !save.isPending && onOpenChange(o)}
      title={p ? `${replacing?.provider === provider ? "Replace" : "Add"} your ${p.name} key` : "Add key"}
      description={`wuup checks the key with ${p?.name ?? "the provider"} before saving it.${shipped.byokKeyEncrypted ? " Keys are stored encrypted." : ""} Only a masked version is shown afterwards.`}
      size="md"
      footer={
        <>
          <Button variant="soft" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancel
          </Button>
          <Button variant="ink" onClick={submit} disabled={save.isPending || !key.trim()} data-testid="save-key">
            {save.isPending ? "Checking key..." : "Save key"}
          </Button>
        </>
      }
    >
      {p && provider ? (
        <div className="flex flex-col gap-5">
          {replacing && replacing.provider !== provider ? (
            <div className="flex items-start gap-3 rounded-xl border border-yellow-100 bg-yellow-50 px-4 py-3 text-[14px] text-tx-secondary">
              <Info className="mt-0.5 size-4 shrink-0 text-yellow-700" strokeWidth={1.5} aria-hidden="true" />
              wuup uses one key at a time. Saving this replaces your {PROVIDERS[replacing.provider].name} key.
            </div>
          ) : null}
          <Field
            label="API key"
            error={error ?? undefined}
            hint={
              <a
                href={p.console}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 font-medium text-indigo-800 underline decoration-indigo-200 underline-offset-2 hover:decoration-indigo-600"
              >
                Get a key from {p.consoleLabel}
                <ArrowUpRight className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
              </a>
            }
          >
            <Input
              type="password"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              placeholder={p.placeholder}
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submit();
                }
              }}
              className="font-mono text-[14px]!"
              data-testid="api-key-input"
            />
          </Field>
        </div>
      ) : null}
    </Dialog>
  );
}

function ProviderCard({
  provider,
  active,
  disabled,
  onAdd,
  onRemove,
}: {
  provider: LlmProvider;
  active: ActiveKey | null;
  disabled: boolean;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const p = PROVIDERS[provider];
  const connected = active?.provider === provider;
  return (
    <li
      className={cn(
        "flex flex-col gap-4 rounded-2xl border bg-sf-white p-5 transition-colors",
        connected ? "border-indigo-200 shadow-[0_0_0_3px_var(--indigo-50)]" : "border-st-secondary",
      )}
      data-testid={`provider-${provider}`}
    >
      <div className="flex items-start gap-3">
        <ProviderTile provider={provider} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[16px] font-medium text-tx">{p.name}</p>
            {connected ? (
              <Pill tone="success" dot>
                Connected
              </Pill>
            ) : null}
          </div>
          <p className="text-[13px] text-tx-tertiary">
            {connected ? <code className="font-mono text-tx-secondary">{active.maskedKey || "Key saved"}</code> : (p.note ?? p.maker)}
          </p>
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2">
        {connected ? (
          <>
            <Button variant="soft" size="sm" onClick={onAdd} disabled={disabled}>
              Replace
            </Button>
            <Button variant="ghost" size="sm" className="text-red-400! hover:bg-red-50!" onClick={onRemove} disabled={disabled}>
              Remove
            </Button>
          </>
        ) : (
          <Button
            variant="soft"
            size="sm"
            leadingIcon={<KeyRound className="size-4" strokeWidth={1.5} aria-hidden="true" />}
            onClick={onAdd}
            disabled={disabled}
          >
            Add key
          </Button>
        )}
        {connected ? null : (
          <a
            href={p.console}
            target="_blank"
            rel="noreferrer"
            aria-label={`Get a ${p.name} key from ${p.consoleLabel} (opens in a new tab)`}
            className="ml-auto inline-flex items-center gap-0.5 rounded-md text-[13px] text-tx-tertiary underline decoration-st underline-offset-2 transition-colors hover:text-tx hover:decoration-tx-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
          >
            Get a key
            <ArrowUpRight className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
          </a>
        )}
      </div>
    </li>
  );
}

function modelStatus(m: ModelOption, usingOwnKey: boolean) {
  if (m.cooldownUntil && new Date(m.cooldownUntil).getTime() > Date.now()) return <Pill tone="warning">Cooling down</Pill>;
  if (m.available) return <Pill tone="success">Available</Pill>;
  return <Pill tone="neutral">{usingOwnKey ? "Unavailable" : "Needs your key"}</Pill>;
}

export function ModelsSettings() {
  const { user } = usePreferences();
  const keys = useKeys();
  const models = useModels();
  const remove = useRemoveKey();
  const [adding, setAdding] = useState<LlmProvider | null>(null);
  const [removing, setRemoving] = useState(false);
  const isDemo = !!user?.isDemo;
  const active = keys.active;

  return (
    <div data-testid="settings-models">
      <SettingsHeader
        title="Models and keys"
        description={`Use the free tier (${FACTS.freeQuestions} answers with Gemini) or bring your own key for unlimited answers. wuup never charges for your key.`}
      />
      <div className="flex flex-col gap-4">
        {isDemo ? (
          <div className="flex items-start gap-3 rounded-2xl border border-sky-100 bg-sky-50 px-5 py-4 text-[14px] text-tx-secondary" role="note">
            <Info className="mt-0.5 size-4 shrink-0 text-sky-700" strokeWidth={1.5} aria-hidden="true" />
            Keys can&apos;t be added in the demo. Create a free account to use your own key.
          </div>
        ) : null}

        <SettingsCard
          title="Your API key"
          description={
            active
              ? `Answers use your ${PROVIDERS[active.provider].name} key. Remove it to go back to the free tier.`
              : "Pick a provider. wuup checks the key before saving it."
          }
        >
          {keys.isPending ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {ORDER.map((p) => (
                <Skeleton key={p} shape="block" className="h-36" />
              ))}
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {ORDER.map((p) => (
                <ProviderCard
                  key={p}
                  provider={p}
                  active={active}
                  disabled={isDemo || remove.isPending}
                  onAdd={() => setAdding(p)}
                  onRemove={() => setRemoving(true)}
                />
              ))}
            </ul>
          )}
        </SettingsCard>

        <SettingsCard
          title="Models"
          description={
            models.data?.usingOwnKey
              ? "Models your key can use. Pick one per chat from the composer."
              : "Models on the free tier. Add a key to unlock the rest."
          }
        >
          {models.isPending ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-5 w-3/5" />
            </div>
          ) : models.isError ? (
            <p className="text-[14px] text-tx-tertiary">Couldn&apos;t load the model list.</p>
          ) : (
            <ul className="-my-1 divide-y divide-st-secondary" data-testid="models-list">
              {models.data?.models.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-3">
                  <ProviderTile provider={m.provider} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] text-tx">{m.id === "auto" ? "Auto (best available)" : m.label}</p>
                    <p className="truncate font-mono text-[12px] text-tx-muted">{m.id}</p>
                  </div>
                  {modelStatus(m, !!models.data?.usingOwnKey)}
                </li>
              ))}
            </ul>
          )}
        </SettingsCard>
      </div>

      <ApiKeyDialog provider={adding} replacing={active} onOpenChange={(o) => !o && setAdding(null)} />
      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        tone="danger"
        title={`Remove your ${active ? PROVIDERS[active.provider].name : ""} key?`}
        body={`wuup deletes the key and you go back to the free tier (${FACTS.freeQuestions} answers with Gemini).`}
        confirmLabel="Remove key"
        onConfirm={async () => {
          try {
            await remove.mutateAsync();
            toast.success("Key removed");
          } catch (e) {
            toast.error("Couldn't remove the key", { description: errorMessage(e) });
          }
        }}
      />
    </div>
  );
}
