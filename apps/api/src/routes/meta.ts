/**
 * Meta routes:
 *   GET  /meta      -> MetaResponse (version, enabled features, client limits, BYOK providers)
 *   POST /waitlist  -> { ok: true }   body: WaitlistBody; auth optional, rate limited
 */
import { Router } from "express";
import { LLM_PROVIDERS, WaitlistBodySchema, type Feature, type MetaResponse } from "@wup/contracts";
import { Waitlist, User } from "@wup/models";
import { env, type Env } from "../config/env";
import { asyncHandler } from "../lib/asyncHandler";
import { HttpError } from "../lib/httpError";
import { optionalAuthenticate } from "../middleware/auth";
import { waitlistLimiter } from "../middleware/rateLimits";
import { validate } from "../middleware/validate";

/** Feature flags computed from env. */
export function computeFeatures(e: Env = env): Feature[] {
  const features: Feature[] = [];
  if (e.RESEARCH_ENABLED) features.push("research");
  features.push("regenerate", "feedback");
  if (e.GOOGLE_SERVICE_ACCOUNT_JSON || e.GOOGLE_SERVICE_ACCOUNT_JSON_PATH) features.push("sheets");
  if (e.SAMPLE_MONGODB_URI) features.push("sample");
  features.push("search", "export");
  if (e.PUBLIC_TOOLS_ENABLED) features.push("publicTools");
  return features;
}

export function buildMeta(e: Env = env): MetaResponse {
  return {
    version: e.APP_VERSION,
    features: computeFeatures(e),
    limits: {
      maxPromptChars: e.MAX_PROMPT_CHARS,
      freeTierLimit: e.FREE_TIER_LIMIT,
    },
    providers: [...LLM_PROVIDERS],
  };
}

const router = Router();

router.get("/meta", (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=60");
  res.json(buildMeta());
});

router.post(
  "/waitlist",
  waitlistLimiter,
  optionalAuthenticate,
  validate({ body: WaitlistBodySchema }),
  asyncHandler(async (req, res) => {
    const { feature } = req.body as { feature: "postgresql" | "mysql"; email?: string };
    let email: string | undefined = req.body.email;
    const userId = req.auth?.userId;

    if (!email && userId && !req.auth?.isDemo) {
      const u = (await User.findById(userId).select("email").lean()) as { email?: string } | null;
      email = u?.email;
    }
    if (!email && !userId) {
      throw new HttpError(400, "VALIDATION_FAILED", "Email is required", [
        { path: "email", message: "Email is required" },
      ]);
    }

    // One entry per (feature, requester): repeat sign-ups are a no-op
    const filter: Record<string, unknown> = { feature };
    if (userId) filter.userId = userId;
    else filter.email = email;
    await Waitlist.updateOne(
      filter,
      { $setOnInsert: { ...(userId && email ? { email } : {}), createdAt: new Date() } },
      { upsert: true }
    );
    res.status(201).json({ ok: true });
  })
);

export default router;
