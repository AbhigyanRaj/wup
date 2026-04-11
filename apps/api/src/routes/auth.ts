import { Router } from "express";
import * as authController from "../controllers/auth";

const router = Router();

router.post("/login", authController.login);
router.get("/verify", authController.verify);

export default router;
