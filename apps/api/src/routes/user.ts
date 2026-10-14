import { Router } from "express";
import {
  DeleteAccountBodySchema,
  SetApiKeyBodySchema,
  UpdatePreferencesBodySchema,
  UpdateProfileBodySchema,
} from "@wup/contracts";
import * as userController from "../controllers/user";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { loginLimiter } from "../middleware/rateLimits";

const router = Router();

// Every route in this file needs a signed-in user.
router.use(authenticate);

router.put("/api-key", validate({ body: SetApiKeyBodySchema }), userController.updateApiKey);
router.delete("/api-key", userController.deleteApiKey);
router.get("/usage", userController.getUsage);
router.get("/models", userController.getModels);
router.patch("/profile", validate({ body: UpdateProfileBodySchema }), userController.updateProfile);
router.patch("/preferences", validate({ body: UpdatePreferencesBodySchema }), userController.updatePreferences);
router.get("/export", userController.exportData);
// Password-confirmed, so it shares the login brute-force limit.
router.delete("/", loginLimiter, validate({ body: DeleteAccountBodySchema }), userController.deleteAccount);

export default router;
