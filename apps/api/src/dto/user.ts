import {
  DEFAULT_USER_PREFERENCES,
  LLM_PROVIDERS,
  type LlmProvider,
  type PlanTier,
  type UserDTO,
  type UserPreferences,
} from "@wup/contracts";

const iso = (d: unknown): string | null => {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d as any);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/** True when the user has a BYOK key stored (encrypted, or legacy plaintext). */
export function hasOwnKey(user: any): boolean {
  return Boolean(user?.customApiKeyEnc) || (typeof user?.customApiKey === "string" && user.customApiKey.length > 0);
}

export function planTier(user: any): PlanTier {
  if (user?.isDemo) return "demo";
  return hasOwnKey(user) ? "byok" : "free";
}

export function keyProvider(user: any): LlmProvider | null {
  if (!hasOwnKey(user)) return null;
  const p = user?.customApiProvider;
  return (LLM_PROVIDERS as readonly string[]).includes(p) ? (p as LlmProvider) : "gemini";
}

function preferencesOf(user: any): UserPreferences {
  const p = user?.preferences ?? {};
  return {
    aboutMe: typeof p.aboutMe === "string" ? p.aboutMe : DEFAULT_USER_PREFERENCES.aboutMe,
    responseStyle: ["concise", "balanced", "detailed"].includes(p.responseStyle)
      ? p.responseStyle
      : DEFAULT_USER_PREFERENCES.responseStyle,
    customInstructions:
      typeof p.customInstructions === "string" ? p.customInstructions : DEFAULT_USER_PREFERENCES.customInstructions,
    preferTables: typeof p.preferTables === "boolean" ? p.preferTables : DEFAULT_USER_PREFERENCES.preferTables,
    showQueriesByDefault:
      typeof p.showQueriesByDefault === "boolean" ? p.showQueriesByDefault : DEFAULT_USER_PREFERENCES.showQueriesByDefault,
  };
}

/** Maps a User document (hydrated or lean) to the public UserDTO. Never includes secrets. */
export function toUserDTO(user: any): UserDTO {
  const createdAt = iso(user?.createdAt) ?? iso(user?._id?.getTimestamp?.()) ?? new Date(0).toISOString();
  return {
    id: String(user._id),
    email: user.email ?? null,
    name: user.name ?? null,
    isDemo: Boolean(user.isDemo),
    demoExpiresAt: user.isDemo ? iso(user.demoExpiresAt) : null,
    createdAt,
    plan: {
      tier: planTier(user),
      provider: keyProvider(user),
      freeTierUsage: Number(user.freeTierUsage ?? 0),
      freeTierLimit: Number(user.freeTierLimit ?? 0),
    },
    preferences: preferencesOf(user),
    onboarding: {
      welcomeSeenAt: iso(user.onboarding?.welcomeSeenAt),
      checklistDismissedAt: iso(user.onboarding?.checklistDismissedAt),
    },
  };
}

/**
 * UserDTO plus the fields the pre-redesign web client reads from
 * POST /auth/login and GET /auth/verify ({ id, email, role }).
 */
export function toLegacyUser(user: any): UserDTO & { role: string } {
  return { ...toUserDTO(user), role: user.role ?? "Founder" };
}
