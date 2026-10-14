import { Router } from "express";
import { ChangePasswordBodySchema, LoginBodySchema, SignupBodySchema } from "@wup/contracts";
import * as authController from "../controllers/auth";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { demoLimiter, loginLimiter, signupLimiter } from "../middleware/rateLimits";

const router = Router();

router.post(
  "/signup",
  signupLimiter,
  authController.normalizeEmailInput,
  validate({ body: SignupBodySchema }),
  authController.signup
);

// Legacy demo login ({ email: "google-demo@wup.ai" } with no password) is handled
// before validation; it has its own demo rate limit.
router.post(
  "/login",
  loginLimiter,
  authController.legacyDemoLogin,
  authController.normalizeEmailInput,
  validate({ body: LoginBodySchema }),
  authController.login
);

router.post("/demo", demoLimiter, authController.demo);
router.post("/logout", authController.logout);
router.get("/me", authenticate, authController.me);
router.get("/verify", authenticate, authController.verify);
router.post(
  "/change-password",
  loginLimiter,
  authenticate,
  validate({ body: ChangePasswordBodySchema }),
  authController.changePassword
);

export default router;
