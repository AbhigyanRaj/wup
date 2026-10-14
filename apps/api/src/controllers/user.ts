import type { Request, Response } from "express";
import * as brain from "@wup/brain";
import { Chat, Connection, KnowledgeChunk, KnowledgeSource, Message, User } from "@wup/models";
import {
  AUTO_MODEL_ID,
  type DeleteAccountBody,
  type LlmProvider,
  type ModelOption,
  type ModelsResponse,
  type SetApiKeyBody,
  type UpdatePreferencesBody,
  type UpdateProfileBody,
  type UsageResponse,
} from "@wup/contracts";
import { hasOwnKey, keyProvider, planTier, toLegacyUser, toUserDTO } from "../dto/user";
import { loadAuthedUser } from "./auth";
import { encryptApiKey, keyHint, resolveLlmCredentials, serverModelRotation } from "../services/llmCredentials";
import { getUsage as getDailyUsage, clampDays } from "../services/usage";
import { deleteUserCascade } from "../services/deleteUser";
import { verifyPassword } from "../services/password";
import { env } from "../config/env";
import { HttpError } from "../lib/httpError";
import { asyncHandler } from "../lib/asyncHandler";
import { clearSession } from "../lib/session";

export const PROVIDER_TIMEOUT_MS = 8000;
export const GROQ_MODELS_URL = "https://api.groq.com/openai/v1/models";

/** Mirrors the brain's Groq chat filter (kept local so an older brain build still validates keys). */
const GROQ_NON_CHAT = /(whisper|tts|orpheus|playai|guard|safeguard|embed|compound)/i;
const isGroqChatModel = (id: string): boolean =>
  typeof (brain as any).isGroqChatModel === "function" ? (brain as any).isGroqChatModel(id) : !!id && !GROQ_NON_CHAT.test(id);
const MAX_STORED_MODELS = 500;

// ─── BYOK key validation ──────────────────────────────────────────────────────

async function providerFetch(url: string, init: RequestInit = {}): Promise<globalThis.Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) });
  } catch (err: any) {
    const timedOut = err?.name === "TimeoutError" || err?.name === "AbortError";
    throw new HttpError(
      502,
      "PROVIDER_ERROR",
      timedOut
        ? "The provider took too long to respond. Please try again."
        : "Could not reach the provider. Please try again."
    );
  }
}

const invalidKey = (label: string, detail?: string) =>
  new HttpError(400, "PROVIDER_AUTH", detail ? `${label}: ${detail}` : `Invalid ${label} API key or unable to reach provider`);

/** Validates a key by listing the provider's models (no tokens spent, except one Gemini region probe). */
export async function listProviderModels(provider: LlmProvider, apiKey: string): Promise<string[]> {
  if (provider === "gemini") {
    const headers = { "x-goog-api-key": apiKey };
    const res = await providerFetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", { headers });
    if (!res.ok) throw invalidKey("Gemini");
    const data: any = await res.json().catch(() => ({}));
    const models: string[] =
      data.models
        ?.filter(
          (m: any) =>
            m.supportedGenerationMethods?.includes("generateContent") ||
            m.supportedGenerationMethods?.includes("bidiGenerateContent")
        )
        ?.map((m: any) => String(m.name).replace("models/", "")) ?? [];

    // Google blocks the API from some server regions even for valid keys. Probe once.
    const probe = await providerFetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: "hi" }] }] }),
      }
    ).catch(() => null);
    const probeBody: any = probe ? await probe.json().catch(() => ({})) : {};
    if (typeof probeBody?.error?.message === "string" && probeBody.error.message.includes("User location")) {
      throw new HttpError(
        400,
        "PROVIDER_ERROR",
        "This API key is valid, but Google does not allow API access from our server's region. Please use a different provider."
      );
    }
    return models;
  }

  if (provider === "openrouter") {
    const res = await providerFetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}`, "HTTP-Referer": "https://wuup.in", "X-Title": "wuup" },
    });
    if (!res.ok) throw invalidKey("OpenRouter");
    // The public model list answers with any key; confirm the key itself.
    const keyRes = await providerFetch("https://openrouter.ai/api/v1/key", {
      headers: { Authorization: `Bearer ${apiKey}` },
    }).catch(() => null);
    if (keyRes && keyRes.status === 401) throw invalidKey("OpenRouter");
    const data: any = await res.json().catch(() => ({}));
    return data.data?.map((m: any) => String(m.id)) ?? [];
  }

  if (provider === "groq") {
    const res = await providerFetch(GROQ_MODELS_URL, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) throw new HttpError(400, "PROVIDER_AUTH", "Invalid Groq API key");
      const err: any = await res.json().catch(() => ({}));
      const msg = typeof err?.error?.message === "string" ? err.error.message.slice(0, 200) : undefined;
      throw invalidKey("Groq", msg);
    }
    const data: any = await res.json().catch(() => ({}));
    // Chat models only: Groq also lists speech, TTS and safety models that can't answer chats.
    const chat: string[] = (Array.isArray(data?.data) ? data.data : [])
      .filter((m: any) => m && m.active !== false)
      .map((m: any) => String(m.id))
      .filter(isGroqChatModel);
    if (chat.length === 0) {
      throw new HttpError(400, "PROVIDER_ERROR", "This Groq key works, but it has no chat models available. Check your Groq console.");
    }
    return chat;
  }

  if (provider === "openai") {
    const res = await providerFetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw invalidKey("OpenAI");
    const data: any = await res.json().catch(() => ({}));
    return data.data?.map((m: any) => String(m.id)) ?? [];
  }

  // anthropic
  const res = await providerFetch("https://api.anthropic.com/v1/models?limit=100", {
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
  });
  if (!res.ok) {
    if (res.status === 401) throw new HttpError(400, "PROVIDER_AUTH", "Invalid Anthropic API key");
    const err: any = await res.json().catch(() => ({}));
    const msg = typeof err?.error?.message === "string" ? err.error.message.slice(0, 200) : undefined;
    throw invalidKey("Anthropic", msg);
  }
  const data: any = await res.json().catch(() => ({}));
  return data.data?.map((m: any) => String(m.id)) ?? [];
}

// ─── API key ──────────────────────────────────────────────────────────────────

export const updateApiKey = asyncHandler(async (req: Request, res: Response) => {
  const user = await loadAuthedUser(req);
  if (user.isDemo) {
    throw new HttpError(403, "FORBIDDEN", "Demo accounts cannot add an API key. Sign up to use your own key.");
  }
  const { apiKey, provider } = req.body as SetApiKeyBody;

  const availableModels = (await listProviderModels(provider, apiKey))
    .filter((m) => typeof m === "string" && m.length > 0 && m.length <= 200)
    .slice(0, MAX_STORED_MODELS);
  const { enc, hint } = encryptApiKey(apiKey);

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        customApiKeyEnc: enc,
        customApiKeyHint: hint,
        customApiProvider: provider,
        availableModels,
      },
      $unset: { customApiKey: 1 },
    }
  );

  res.json({ success: true, message: "API key saved", provider, maskedKey: hint, availableModels });
});

export const deleteApiKey = asyncHandler(async (req: Request, res: Response) => {
  const user = await loadAuthedUser(req);
  await User.updateOne(
    { _id: user._id },
    {
      $set: { availableModels: [] },
      $unset: { customApiKey: 1, customApiKeyEnc: 1, customApiKeyHint: 1, customApiProvider: 1 },
    }
  );
  // The legacy web client only checks res.ok, so 204 is safe for it.
  res.status(204).end();
});

// ─── Profile and preferences ──────────────────────────────────────────────────

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = await loadAuthedUser(req);
  const { name } = req.body as UpdateProfileBody;
  const fresh = await User.findByIdAndUpdate(user._id, { $set: { name } }, { new: true });
  res.json({ user: toUserDTO(fresh) });
});

const PREFERENCE_KEYS = ["aboutMe", "responseStyle", "customInstructions", "preferTables", "showQueriesByDefault"] as const;

export const updatePreferences = asyncHandler(async (req: Request, res: Response) => {
  const user = await loadAuthedUser(req);
  const body = req.body as UpdatePreferencesBody;
  const set: Record<string, unknown> = {};

  for (const key of PREFERENCE_KEYS) {
    if (body[key] !== undefined) set[`preferences.${key}`] = body[key];
  }
  const now = new Date();
  if (body.onboarding?.welcomeSeen && !user.onboarding?.welcomeSeenAt) set["onboarding.welcomeSeenAt"] = now;
  if (body.onboarding?.checklistDismissed && !user.onboarding?.checklistDismissedAt) {
    set["onboarding.checklistDismissedAt"] = now;
  }

  const fresh = Object.keys(set).length
    ? await User.findByIdAndUpdate(user._id, { $set: set }, { new: true, runValidators: true })
    : user;
  res.json({ user: toUserDTO(fresh) });
});

// ─── Usage ────────────────────────────────────────────────────────────────────

function maskedKeyOf(user: any): string | undefined {
  if (user.customApiKeyEnc) return user.customApiKeyHint || "••••••••";
  if (typeof user.customApiKey === "string" && user.customApiKey) return keyHint(user.customApiKey);
  return undefined;
}

export const getUsage = asyncHandler(async (req: Request, res: Response) => {
  const user = await loadAuthedUser(req);
  const days = clampDays(req.query.days);
  const tier = planTier(user);
  const used = Number(user.freeTierUsage ?? 0);
  const limit = tier === "byok" ? null : Number(user.freeTierLimit ?? 0);
  const ownKey = hasOwnKey(user);
  const maskedKey = maskedKeyOf(user);
  const provider = keyProvider(user);

  const [{ daily, totals }, chunksUsed, bridges, documents, chats] = await Promise.all([
    getDailyUsage(user, days),
    KnowledgeChunk.countDocuments({ userId: user._id }),
    Connection.countDocuments({ userId: user._id }),
    KnowledgeSource.countDocuments({ userId: user._id }),
    Chat.countDocuments({ userId: user._id }),
  ]);

  const b = brain as any;
  const body: UsageResponse = {
    plan: {
      tier,
      limit,
      used,
      remaining: limit === null ? null : Math.max(0, limit - used),
      researchCost: env.RESEARCH_COST,
    },
    apiKey: ownKey && provider && maskedKey ? { provider, maskedKey } : null,
    daily,
    totals,
    limits: {
      maxUploadMb: env.MAX_UPLOAD_SIZE_MB,
      maxSources: env.MAX_SOURCES_PER_USER,
      maxChunks: env.MAX_CHUNKS_PER_USER,
      chunksUsed,
      maxRowsPerQuery: typeof b.MAX_LIMIT === "number" ? b.MAX_LIMIT : 100,
      queryTimeoutMs: typeof b.QUERY_TIMEOUT_MS === "number" ? b.QUERY_TIMEOUT_MS : 10000,
    },
    counts: { bridges, documents, chats },

    // Legacy fields read by the pre-redesign web client.
    freeTierUsage: used,
    freeTierLimit: Number(user.freeTierLimit ?? 0),
    hasCustomKey: ownKey,
    ...(maskedKey ? { maskedKey } : {}),
    ...(typeof user.customApiProvider === "string" && user.customApiProvider
      ? { provider: user.customApiProvider }
      : {}),
    availableModels: Array.isArray(user.availableModels) ? user.availableModels : [],
  };
  res.json(body);
});

// ─── Models ───────────────────────────────────────────────────────────────────

const PROVIDER_LABEL_PREFIX: Partial<Record<LlmProvider, RegExp>> = { gemini: /^gemini-/ };

export function modelLabel(id: string): string {
  if (id === AUTO_MODEL_ID) return "Auto";
  const base = id.split("/").pop() ?? id;
  return base
    .replace(PROVIDER_LABEL_PREFIX.gemini!, "Gemini ")
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => (/^\d/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function staticModels(user: any, provider: LlmProvider, usingOwnKey: boolean): ModelOption[] {
  const ids: string[] = usingOwnKey
    ? (Array.isArray(user.availableModels) ? user.availableModels : []).slice(0, 200)
    : [...new Set([...serverModelRotation(), ...env.SERVER_MODEL_ALLOWLIST])];
  return [AUTO_MODEL_ID, ...ids.filter((id) => id !== AUTO_MODEL_ID)].map((id) => ({
    id,
    label: modelLabel(id),
    provider,
    available: true,
    cooldownUntil: null,
  }));
}

export const getModels = asyncHandler(async (req: Request, res: Response) => {
  const user = await loadAuthedUser(req);
  const credentials = await resolveLlmCredentials(user);
  const usingOwnKey = credentials.apiKey !== null && !user.isDemo;
  const provider = credentials.provider;

  const listModels = (brain as any).listModels;
  if (typeof listModels === "function") {
    try {
      const out = await (brain as any).listModels(credentials, { availableModels: user.availableModels ?? [] });
      const models: ModelOption[] | undefined = Array.isArray(out) ? out : out?.models;
      if (Array.isArray(models) && models.length > 0) {
        const withAuto = models.some((m) => m.id === AUTO_MODEL_ID)
          ? [...models.filter((m) => m.id === AUTO_MODEL_ID), ...models.filter((m) => m.id !== AUTO_MODEL_ID)]
          : [{ id: AUTO_MODEL_ID, label: "Auto", provider, available: true, cooldownUntil: null }, ...models];
        const body: ModelsResponse = {
          provider: out?.provider ?? provider,
          usingOwnKey: out?.usingOwnKey ?? usingOwnKey,
          models: withAuto,
        };
        return res.json(body);
      }
    } catch (err: any) {
      console.error("[WUP API] listModels failed, using the static list:", err?.message ?? err);
    }
  }

  const body: ModelsResponse = { provider, usingOwnKey, models: staticModels(user, provider, usingOwnKey) };
  res.json(body);
});

// ─── Export ───────────────────────────────────────────────────────────────────

export const exportData = asyncHandler(async (req: Request, res: Response) => {
  const user = await loadAuthedUser(req);
  const userId = user._id;

  const [chats, messages, connections, knowledgeSources] = await Promise.all([
    Chat.find({ userId }).sort({ createdAt: 1 }).lean(),
    Message.find({ userId }).sort({ createdAt: 1 }).lean(),
    // Metadata only: never the encrypted config, cached schema samples or error text.
    Connection.find({ userId })
      .select({ name: 1, type: 1, scope: 1, redactedFields: 1, isSystem: 1, createdAt: 1, "metadata.status": 1, "metadata.lastSynced": 1 })
      .lean(),
    KnowledgeSource.find({ userId }).lean(),
  ]);

  const day = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="wuup-export-${day}.json"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        profile: toLegacyUser(user),
        chats,
        messages,
        connections,
        knowledgeSources,
      },
      null,
      2
    )
  );
});

// ─── Account deletion ─────────────────────────────────────────────────────────

export const deleteAccount = asyncHandler(async (req: Request, res: Response) => {
  const user = await loadAuthedUser(req);
  const { password } = req.body as DeleteAccountBody;

  if (!user.isDemo) {
    if (!password) {
      throw new HttpError(400, "VALIDATION_FAILED", "Enter your password to delete your account", [
        { path: "password", message: "Password is required" },
      ]);
    }
    if (!(await verifyPassword(password, user.password))) {
      throw new HttpError(400, "VALIDATION_FAILED", "That password is incorrect", [
        { path: "password", message: "That password is incorrect" },
      ]);
    }
  }

  await deleteUserCascade(user._id);
  clearSession(res);
  res.status(204).end();
});
