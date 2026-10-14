import { z } from "zod";
import { EmailSchema } from "./auth";
import { ISODateSchema } from "./common";

export const FEATURES = [
  "research",
  "regenerate",
  "feedback",
  "sheets",
  "sample",
  "search",
  "export",
  "publicTools",
] as const;
export const FeatureSchema = z.enum(FEATURES);
export type Feature = z.infer<typeof FeatureSchema>;

export const MetaResponseSchema = z.object({
  version: z.string(),
  /** Feature flags enabled on this server. Clients hide UI for anything missing. */
  features: z.array(FeatureSchema),
  limits: z.object({
    maxPromptChars: z.number(),
    freeTierLimit: z.number(),
  }),
});
export type MetaResponse = z.infer<typeof MetaResponseSchema>;

export const WaitlistFeatureSchema = z.enum(["postgresql", "mysql"]);
export type WaitlistFeature = z.infer<typeof WaitlistFeatureSchema>;

export const WaitlistBodySchema = z.object({
  feature: WaitlistFeatureSchema,
  /** Optional for signed-in users (their account email is used). */
  email: EmailSchema.optional(),
});
export type WaitlistBody = z.infer<typeof WaitlistBodySchema>;

export const HealthResponseSchema = z.object({
  /** "healthy" when the API and database are up, "degraded" otherwise. */
  status: z.enum(["healthy", "degraded"]),
  timestamp: ISODateSchema,
  version: z.string().optional(),
  uptimeS: z.number().optional(),
  db: z.enum(["up", "down"]).optional(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
