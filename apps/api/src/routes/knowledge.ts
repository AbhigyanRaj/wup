import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { handleUpload } from "../middleware/upload";
import { uploadLimiter } from "../middleware/rateLimits";
import { asyncHandler } from "../lib/asyncHandler";
import { objectIdParam } from "../lib/objectId";
import {
  uploadKnowledge,
  listKnowledge,
  getKnowledgeSource,
  getKnowledgeStatus,
  getKnowledgeConfig,
  retryKnowledge,
  deleteKnowledge,
} from "../controllers/knowledge";

const router = Router();

// All knowledge routes require authentication
router.use(authenticate);
// 400 for a malformed :sourceId
objectIdParam(router, "sourceId");

// POST   /knowledge/upload             receive file, queue ingestion (202)
// S-8: UPLOAD_RATE_LIMIT_PER_HOUR per user, shared with retry
router.post("/upload", uploadLimiter, handleUpload, asyncHandler(uploadKnowledge));

// GET    /knowledge                    list all sources (KnowledgeSourceDTO[])
router.get("/", asyncHandler(listKnowledge));

// GET    /knowledge/config             upload limits (KnowledgeConfig)
router.get("/config", asyncHandler(getKnowledgeConfig));

// GET    /knowledge/:sourceId/status   legacy poll shape (+ progress)
router.get("/:sourceId/status", asyncHandler(getKnowledgeStatus));

// POST   /knowledge/:sourceId/retry    re-queue a failed source from its stored text (202)
router.post("/:sourceId/retry", uploadLimiter, asyncHandler(retryKnowledge));

// GET    /knowledge/:sourceId          one source (KnowledgeSourceDTO)
router.get("/:sourceId", asyncHandler(getKnowledgeSource));

// DELETE /knowledge/:sourceId          delete source, chunks and stored text
router.delete("/:sourceId", asyncHandler(deleteKnowledge));

export default router;
