import { Router } from "express";
import * as connectionController from "../controllers/connection";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createConnectionSchema } from "../validation/schemas";

const router = Router();

// All connection routes are protected
router.use(authenticate);

router.post("/", validate(createConnectionSchema), connectionController.createConnection);
router.get("/", connectionController.getConnections);
router.delete("/:id", connectionController.deleteConnection);

export default router;
