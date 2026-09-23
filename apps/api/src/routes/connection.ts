import { Router } from "express";
import * as connectionController from "../controllers/connection";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createConnectionSchema, testConnectionSchema, updateConnectionSchema } from "../validation/schemas";

const router = Router();

// All connection routes are protected
router.use(authenticate);

router.post("/test", validate(testConnectionSchema), connectionController.testConnection);
router.post("/", validate(createConnectionSchema), connectionController.createConnection);
router.get("/", connectionController.getConnections);
router.get("/:id", connectionController.getConnection);
router.patch("/:id", validate(updateConnectionSchema), connectionController.updateConnection);
router.post("/:id/refresh", connectionController.refreshConnection);
router.delete("/:id", connectionController.deleteConnection);

export default router;
