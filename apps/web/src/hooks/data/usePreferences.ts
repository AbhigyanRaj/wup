"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { AuthResponse, UpdatePreferencesBody, UpdateProfileBody, UserDTO, UserPreferences } from "@/lib/types";
import { useMe } from "./useMe";

/** Mirrors DEFAULT_USER_PREFERENCES in @wup/contracts (kept local so zod stays out of the bundle). */
export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  aboutMe: "",
  responseStyle: "balanced",
  customInstructions: "",
  preferTables: false,
  showQueriesByDefault: false,
};

type UserResponse = UserDTO | AuthResponse | { user: UserDTO };

function unwrapUser(res: UserResponse | undefined): UserDTO | null {
  if (!res || typeof res !== "object") return null;
  if ("user" in res && res.user) return res.user as UserDTO;
  if ("id" in res) return res as UserDTO;
  return null;
}

/** The signed-in user's preferences (from GET /auth/me), with defaults filled in. */
export function usePreferences() {
  const me = useMe();
  const prefs: UserPreferences = { ...DEFAULT_USER_PREFERENCES, ...(me.data?.preferences ?? {}) };
  return { ...me, user: me.data ?? null, prefs };
}

/** PATCH /user/preferences. Updates the cached user on success. */
export function useUpdatePreferences() {
  const qc = useQueryClient();
  return useMutation({
    meta: { silent: true },
    mutationFn: (body: UpdatePreferencesBody) =>
      api<UserResponse | { preferences: UserPreferences }>("/user/preferences", { method: "PATCH", json: body }),
    onSuccess: (res, body) => {
      const user = unwrapUser(res as UserResponse);
      qc.setQueryData<UserDTO | null>(qk.me, (old) => {
        if (user) return user;
        if (!old) return old;
        const preferences =
          res && typeof res === "object" && "preferences" in res && res.preferences
            ? (res.preferences as UserPreferences)
            : { ...old.preferences, ...stripOnboarding(body) };
        return { ...old, preferences };
      });
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.me }),
  });
}

function stripOnboarding(body: UpdatePreferencesBody): Partial<UserPreferences> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { onboarding, ...rest } = body;
  return rest;
}

/** PATCH /user/profile. */
export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    meta: { silent: true },
    mutationFn: (body: UpdateProfileBody) => api<UserResponse>("/user/profile", { method: "PATCH", json: body }),
    onSuccess: (res, body) => {
      const user = unwrapUser(res);
      qc.setQueryData<UserDTO | null>(qk.me, (old) => user ?? (old ? { ...old, name: body.name } : old));
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.me }),
  });
}
