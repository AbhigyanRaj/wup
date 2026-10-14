import { z } from "zod";
import { ISODateSchema, IdSchema, LIMITS } from "./common";

// ─── Plans and providers ──────────────────────────────────────────────────────

export const LLM_PROVIDERS = ["gemini", "openai", "openrouter", "anthropic", "groq"] as const;
export const LlmProviderSchema = z.enum(LLM_PROVIDERS);
export type LlmProvider = z.infer<typeof LlmProviderSchema>;

export const PlanTierSchema = z.enum(["free", "byok", "demo"]);
export type PlanTier = z.infer<typeof PlanTierSchema>;

export const ResponseStyleSchema = z.enum(["concise", "balanced", "detailed"]);
export type ResponseStyle = z.infer<typeof ResponseStyleSchema>;

// ─── Preferences ──────────────────────────────────────────────────────────────

export const UserPreferencesSchema = z.object({
  aboutMe: z.string().max(LIMITS.maxPreferenceText),
  responseStyle: ResponseStyleSchema,
  customInstructions: z.string().max(LIMITS.maxPreferenceText),
  preferTables: z.boolean(),
  showQueriesByDefault: z.boolean(),
});
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  aboutMe: "",
  responseStyle: "balanced",
  customInstructions: "",
  preferTables: false,
  showQueriesByDefault: false,
};

// ─── User ─────────────────────────────────────────────────────────────────────

export const UserPlanSchema = z.object({
  tier: PlanTierSchema,
  provider: LlmProviderSchema.nullable(),
  freeTierUsage: z.number(),
  freeTierLimit: z.number(),
});
export type UserPlan = z.infer<typeof UserPlanSchema>;

export const UserOnboardingSchema = z.object({
  welcomeSeenAt: ISODateSchema.nullable(),
  checklistDismissedAt: ISODateSchema.nullable(),
});
export type UserOnboarding = z.infer<typeof UserOnboardingSchema>;

export const UserDTOSchema = z.object({
  id: IdSchema,
  email: z.string().nullable(),
  name: z.string().nullable(),
  isDemo: z.boolean(),
  demoExpiresAt: ISODateSchema.nullable(),
  createdAt: ISODateSchema,
  plan: UserPlanSchema,
  preferences: UserPreferencesSchema,
  onboarding: UserOnboardingSchema,
});
export type UserDTO = z.infer<typeof UserDTOSchema>;

// ─── Request bodies ───────────────────────────────────────────────────────────

export const NameSchema = z.string().trim().min(1, "Name is required").max(LIMITS.maxNameLength);

export const UpdateProfileBodySchema = z.object({
  name: NameSchema,
});
export type UpdateProfileBody = z.infer<typeof UpdateProfileBodySchema>;

export const UpdatePreferencesBodySchema = UserPreferencesSchema.partial().extend({
  onboarding: z
    .object({
      welcomeSeen: z.literal(true).optional(),
      checklistDismissed: z.literal(true).optional(),
    })
    .optional(),
});
export type UpdatePreferencesBody = z.infer<typeof UpdatePreferencesBodySchema>;

export const SetApiKeyBodySchema = z.object({
  /** Defaults to gemini for older clients that did not send a provider. */
  provider: LlmProviderSchema.default("gemini"),
  apiKey: z.string().trim().min(10, "That API key looks too short").max(400, "That API key looks too long"),
});
export type SetApiKeyBody = z.infer<typeof SetApiKeyBodySchema>;
export type SetApiKeyBodyInput = z.input<typeof SetApiKeyBodySchema>;

export const DeleteAccountBodySchema = z.object({
  /** Required for accounts that have a password. Demo accounts have none. */
  password: z.string().max(1024).optional(),
  confirm: z.literal("DELETE", { message: 'Type "DELETE" to confirm' }),
});
export type DeleteAccountBody = z.infer<typeof DeleteAccountBodySchema>;

// ─── Usage ────────────────────────────────────────────────────────────────────

export const UsageDaySchema = z.object({
  /** YYYY-MM-DD (UTC) */
  date: z.string(),
  messages: z.number(),
  research: z.number(),
  tokensIn: z.number(),
  tokensOut: z.number(),
});
export type UsageDay = z.infer<typeof UsageDaySchema>;

export const UsageResponseSchema = z.object({
  plan: z.object({
    tier: PlanTierSchema,
    /** null = unlimited (BYOK) */
    limit: z.number().nullable(),
    used: z.number(),
    remaining: z.number().nullable(),
    /** How many free-tier messages one research run costs. */
    researchCost: z.number(),
  }),
  apiKey: z
    .object({
      provider: LlmProviderSchema,
      maskedKey: z.string(),
    })
    .nullable(),
  daily: z.array(UsageDaySchema),
  totals: z.object({
    messages: z.number(),
    research: z.number(),
    tokensIn: z.number(),
    tokensOut: z.number(),
  }),
  limits: z.object({
    maxUploadMb: z.number(),
    maxSources: z.number(),
    maxChunks: z.number(),
    chunksUsed: z.number(),
    maxRowsPerQuery: z.number(),
    queryTimeoutMs: z.number(),
  }),
  counts: z.object({
    bridges: z.number(),
    documents: z.number(),
    chats: z.number(),
  }),

  /** @deprecated use plan.used */
  freeTierUsage: z.number(),
  /** @deprecated use plan.limit */
  freeTierLimit: z.number(),
  /** @deprecated use apiKey !== null */
  hasCustomKey: z.boolean(),
  /** @deprecated use apiKey.maskedKey */
  maskedKey: z.string().optional(),
  /** @deprecated use apiKey.provider */
  provider: z.string().optional(),
  /** @deprecated use GET /user/models */
  availableModels: z.array(z.string()),
});
export type UsageResponse = z.infer<typeof UsageResponseSchema>;

// ─── Models ───────────────────────────────────────────────────────────────────

/** The pseudo model id that lets the server route to the best available model. */
export const AUTO_MODEL_ID = "auto";

export const ModelOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  provider: LlmProviderSchema,
  available: z.boolean(),
  /** Set while a model is rate limited or exhausted. */
  cooldownUntil: ISODateSchema.nullable(),
});
export type ModelOption = z.infer<typeof ModelOptionSchema>;

export const ModelsResponseSchema = z.object({
  provider: LlmProviderSchema,
  usingOwnKey: z.boolean(),
  /** Always includes the "auto" option first. */
  models: z.array(ModelOptionSchema),
});
export type ModelsResponse = z.infer<typeof ModelsResponseSchema>;
