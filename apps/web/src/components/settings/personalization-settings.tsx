"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { SegmentedControl } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { ResponseStyle, UserPreferences } from "@/lib/types";
import { usePreferences, useUpdatePreferences } from "@/hooks/data/usePreferences";
import { SettingRow, SettingsCard, SettingsHeader } from "./settings-ui";

const MAX = 1500;

const STYLE_HINT: Record<ResponseStyle, string> = {
  concise: "Short answers that lead with the number.",
  balanced: "A clear answer with the context that matters.",
  detailed: "Full explanations, caveats and next steps.",
};

function Counter({ value, id }: { value: string; id: string }) {
  const left = MAX - value.length;
  return (
    <span id={id} className={cn("tabular-nums", left < 100 ? "text-yellow-700" : "text-tx-muted")} aria-live="polite">
      {value.length.toLocaleString("en-US")} / {MAX.toLocaleString("en-US")}
    </span>
  );
}

function Form({ initial }: { initial: UserPreferences }) {
  const update = useUpdatePreferences();
  const [p, setP] = useState<UserPreferences>(initial);
  const [saved, setSaved] = useState<UserPreferences>(initial);
  const dirty = JSON.stringify(p) !== JSON.stringify(saved);
  const set = <K extends keyof UserPreferences>(k: K, v: UserPreferences[K]) => setP((prev) => ({ ...prev, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await update.mutateAsync({
        aboutMe: p.aboutMe.slice(0, MAX),
        customInstructions: p.customInstructions.slice(0, MAX),
        responseStyle: p.responseStyle,
        preferTables: p.preferTables,
        showQueriesByDefault: p.showQueriesByDefault,
      });
      setSaved(p);
      toast.success("Preferences saved");
    } catch (err) {
      toast.error("Couldn't save your preferences", { description: errorMessage(err) });
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4" noValidate>
      <SettingsCard as="div" title="About you" description="wuup reads this before every answer.">
        <div className="flex flex-col gap-6">
          <Field label="What should wuup know about you?" hint={<Counter value={p.aboutMe} id="about-count" />}>
            <Textarea
              value={p.aboutMe}
              maxLength={MAX}
              rows={4}
              placeholder="I run growth at a D2C brand. Revenue is in INR, weeks start on Monday."
              onChange={(e) => set("aboutMe", e.target.value)}
              data-testid="about-me"
            />
          </Field>
          <Field label="How should wuup respond?" hint={<Counter value={p.customInstructions} id="instr-count" />}>
            <Textarea
              value={p.customInstructions}
              maxLength={MAX}
              rows={4}
              placeholder="Round money to whole rupees. Call out anything that looks unusual."
              onChange={(e) => set("customInstructions", e.target.value)}
              data-testid="custom-instructions"
            />
          </Field>
        </div>
      </SettingsCard>

      <SettingsCard
        as="div"
        title="Answers"
        footerNote={dirty ? "You have unsaved changes." : undefined}
        footer={
          <>
            {dirty ? (
              <Button variant="soft" onClick={() => setP(saved)} disabled={update.isPending}>
                Discard
              </Button>
            ) : null}
            <Button type="submit" variant="ink" disabled={!dirty || update.isPending} data-testid="save-preferences">
              {update.isPending ? "Saving..." : "Save preferences"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col divide-y divide-st-secondary">
          <div className="flex flex-col gap-3 pb-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div>
              <p id="style-label" className="text-[15px] font-medium text-tx">
                Response style
              </p>
              <p className="mt-0.5 text-[14px] text-tx-tertiary">{STYLE_HINT[p.responseStyle]}</p>
            </div>
            <SegmentedControl<ResponseStyle>
              aria-labelledby="style-label"
              size="sm"
              value={p.responseStyle}
              onChange={(v) => set("responseStyle", v)}
              options={[
                { value: "concise", label: "Concise" },
                { value: "balanced", label: "Balanced" },
                { value: "detailed", label: "Detailed" },
              ]}
            />
          </div>
          <SettingRow
            className="pt-5!"
            title={<label htmlFor="pref-tables">Prefer tables for numbers</label>}
            description="Show figures as a table when an answer has more than a couple of numbers."
            control={<Switch id="pref-tables" checked={p.preferTables} onCheckedChange={(v) => set("preferTables", v)} />}
          />
          <SettingRow
            title={<label htmlFor="pref-queries">Open queries by default</label>}
            description="Expand the queries wuup ran under each answer, so you can check them."
            control={
              <Switch id="pref-queries" checked={p.showQueriesByDefault} onCheckedChange={(v) => set("showQueriesByDefault", v)} />
            }
          />
        </div>
      </SettingsCard>
    </form>
  );
}

export function PersonalizationSettings() {
  const { user, prefs, isPending } = usePreferences();
  return (
    <div data-testid="settings-personalization">
      <SettingsHeader title="Personalization" description="Context and style wuup uses in every answer." />
      {isPending || !user ? <Skeleton shape="block" className="h-96 w-full" /> : <Form key={user.id} initial={prefs} />}
    </div>
  );
}
