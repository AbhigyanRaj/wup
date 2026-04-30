import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate } from "../middleware/auth";
import { handleUpload } from "../middleware/upload";
import {
  uploadKnowledge,
  listKnowledge,
  getKnowledgeStatus,
  deleteKnowledge,
} from "../controllers/knowledge";

const router = Router();

// All knowledge routes require authentication
router.use(authenticate);

// S-8: Rate limiter — max 10 uploads per user per 15 minutes
const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.UPLOAD_RATE_LIMIT_PER_HOUR ?? "10", 10),
  keyGenerator: (req) => (req as any).user?.id ?? req.ip,
  message: {
    error: "Too many uploads. Maximum 10 per 15 minutes. Please wait and try again.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST   /knowledge/upload     → receive file → kick off ingestion (202 Accepted)
router.post("/upload", uploadRateLimiter, handleUpload, uploadKnowledge);

// GET    /knowledge             → list all sources for the user
router.get("/", listKnowledge);

// GET    /knowledge/:sourceId/status  → poll indexing status
router.get("/:sourceId/status", getKnowledgeStatus);

// DELETE /knowledge/:sourceId   → delete source + all its chunks
router.delete("/:sourceId", deleteKnowledge);

export default router;
