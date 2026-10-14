import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as authController from "../controllers/auth";

const router = Router();

// Brute-force / signup-spam protection: 20 login attempts per IP per 15 minutes.
// Relies on `app.set("trust proxy", 1)` in server.ts so req.ip is the client IP.
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    error: "Too many login attempts. Please wait a few minutes and try again.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/login", loginRateLimiter, authController.login);
router.get("/verify", authController.verify);

export default router;
