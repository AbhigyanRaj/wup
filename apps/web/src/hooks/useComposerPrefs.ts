"use client";

import * as React from "react";
import { useModels } from "@/hooks/data/useModels";
import { useMe } from "@/hooks/data/useMe";
import { toast } from "@/components/ui/toast";

/*
 * Composer preferences (model and web search), remembered per user in
 * localStorage. The saved model is checked against GET /user/models: when it
 * is gone or unavailable, it resets to "auto" with a toast.
 */

export const AUTO_MODEL = "auto";

interface Prefs {
  model: string;
  searchWeb: boolean;
}

const DEFAULTS: Prefs = { model: AUTO_MODEL, searchWeb: false };
const CHANGE_EVENT = "wuup:composer-prefs";

function storageKey(userId: string | undefined) {
  return `wuup:composer:${userId ?? "anon"}`;
}

function read(key: string): Prefs {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw) as Partial<Prefs>;
    return {
      model: typeof p.model === "string" && p.model ? p.model : DEFAULTS.model,
      searchWeb: typeof p.searchWeb === "boolean" ? p.searchWeb : DEFAULTS.searchWeb,
    };
  } catch {
    return DEFAULTS;
  }
}

function write(key: string, prefs: Prefs) {
  try {
    window.localStorage.setItem(key, JSON.stringify(prefs));
  } catch {
    /* storage blocked: prefs last for this page only */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

const cache = new Map<string, { raw: string | null; value: Prefs }>();

function snapshot(key: string): Prefs {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    raw = null;
  }
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value;
  const value = read(key);
  cache.set(key, { raw, value });
  return value;
}

function subscribe(cb: () => void) {
  window.addEventListener(CHANGE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useComposerPrefs() {
  const { data: me } = useMe();
  const key = storageKey(me?.id);
  const prefs = React.useSyncExternalStore(
    subscribe,
    () => snapshot(key),
    () => DEFAULTS,
  );
  const models = useModels();

  const setModel = React.useCallback((model: string) => write(key, { ...snapshot(key), model }), [key]);
  const setSearchWeb = React.useCallback(
    (searchWeb: boolean) => write(key, { ...snapshot(key), searchWeb }),
    [key],
  );

  // Validate the saved model once the list is known.
  const list = models.data?.models;
  React.useEffect(() => {
    if (!list || prefs.model === AUTO_MODEL) return;
    const found = list.find((m) => m.id === prefs.model);
    if (!found || !found.available) {
      write(key, { ...snapshot(key), model: AUTO_MODEL });
      toast("Switched to Auto", {
        description: found
          ? `${found.label} is not available right now, so wuup will pick the best model.`
          : "Your saved model is no longer offered, so wuup will pick the best model.",
      });
    }
  }, [list, prefs.model, key]);

  return { ...prefs, setModel, setSearchWeb, models: list ?? [], modelsLoading: models.isLoading };
}
