import { Router } from "express";
import { z } from "zod";
import {
  CreateConnectionBodySchema,
  TestConnectionBodySchema,
  UpdateConnectionBodySchema,
} from "@wup/contracts";
import * as connectionController from "../controllers/connection";
import { authenticate } from "../middleware/auth";
import { connectionLimiter } from "../middleware/rateLimits";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../lib/asyncHandler";
import { objectIdParam } from "../lib/objectId";

/**
 * Bodies follow @wup/contracts, except that `type` also accepts the legacy
 * "postgresql" / "supabase" values so the controller can answer
 * "coming soon" instead of a generic validation error.
 */
const AnyBridgeType = z.enum(["mongodb", "sheets", "postgresql", "supabase"], {
  message: "Bridges currently support MongoDB and Google Sheets",
});
const TestBody = TestConnectionBodySchema.extend({ type: AnyBridgeType });
const CreateBody = CreateConnectionBodySchema.extend({ type: AnyBridgeType });

const router = Router();

// All connection routes are protected
router.use(authenticate);
objectIdParam(router, "id");

router.get("/sheets/service-account", asyncHandler(connectionController.getSheetsServiceAccount));
router.post("/sample", connectionLimiter, asyncHandler(connectionController.createSampleConnection));
router.post("/test", connectionLimiter, validate({ body: TestBody }), asyncHandler(connectionController.testConnection));
router.post("/", connectionLimiter, validate({ body: CreateBody }), asyncHandler(connectionController.createConnection));
router.get("/", asyncHandler(connectionController.getConnections));
router.get("/:id", asyncHandler(connectionController.getConnection));
router.patch("/:id", validate({ body: UpdateConnectionBodySchema }), asyncHandler(connectionController.updateConnection));
router.post("/:id/refresh", asyncHandler(connectionController.refreshConnection));
router.delete("/:id", asyncHandler(connectionController.deleteConnection));

export default router;
