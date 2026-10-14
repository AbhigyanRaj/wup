import { z } from "zod";
import { ISODateSchema, LIMITS, utf8ByteLength } from "./common";
import { NameSchema, UserDTOSchema } from "./user";

/**
 * Emails are trimmed and lowercased on the way in. Legacy mixed-case rows are
 * normalised by migration 003-lowercase-emails, which must run before these
 * schemas guard the login route.
 */
export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(LIMITS.maxEmailLength, "Email is too long")
  .pipe(z.email({ message: "Enter a valid email address" }));

/** Password policy for new passwords: 10 to 72 UTF-8 bytes (the bcrypt input limit). */
export const PasswordSchema = z
  .string()
  .refine((v) => utf8ByteLength(v) >= LIMITS.minPasswordBytes, {
    message: `Password must be at least ${LIMITS.minPasswordBytes} characters`,
  })
  .refine((v) => utf8ByteLength(v) <= LIMITS.maxPasswordBytes, {
    message: `Password must be at most ${LIMITS.maxPasswordBytes} bytes`,
  });

/** Existing passwords are not re-validated against the policy, only bounded. */
const ExistingPasswordSchema = z.string().min(1, "Password is required").max(1024);

export const SignupBodySchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  name: NameSchema.optional(),
});
export type SignupBody = z.infer<typeof SignupBodySchema>;

export const LoginBodySchema = z.object({
  email: EmailSchema,
  password: ExistingPasswordSchema,
});
export type LoginBody = z.infer<typeof LoginBodySchema>;

export const ChangePasswordBodySchema = z.object({
  currentPassword: ExistingPasswordSchema,
  newPassword: PasswordSchema,
});
export type ChangePasswordBody = z.infer<typeof ChangePasswordBodySchema>;

// ─── Responses ────────────────────────────────────────────────────────────────

/** Response of signup, login and GET /auth/me. Session transport is the API's concern. */
export const AuthResponseSchema = z.object({
  user: UserDTOSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const DemoResponseSchema = AuthResponseSchema.extend({
  demo: z.object({
    expiresAt: ISODateSchema,
    seededKnowledge: z.boolean(),
    seededBridge: z.boolean(),
  }),
});
export type DemoResponse = z.infer<typeof DemoResponseSchema>;
