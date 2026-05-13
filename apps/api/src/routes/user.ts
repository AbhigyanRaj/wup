import { Router } from "express";
import * as userController from "../controllers/user";
import { authenticate } from "../middleware/auth";

const router = Router();

// Protect all routes in this file
router.use(authenticate);

router.put("/api-key", userController.updateApiKey);
router.get("/usage", userController.getUsage);

export default router;
