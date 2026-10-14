import { Router } from "express";
import { z } from "zod";
import {
  CreateChatBodySchema,
  DiagramKeySchema,
  FeedbackBodySchema,
  ListChatsQuerySchema,
  RegenerateBodySchema,
  SaveDiagramBodySchema,
  SendMessageBodySchema,
  UpdateChatBodySchema,
} from "@wup/contracts";
import * as chat from "../controllers/chat";
import { resetDiagram, saveDiagram } from "../controllers/chat/diagrams";
import { chatLimiter, objectIdParam, validate } from "../controllers/chat/deps";
import { authenticate } from "../middleware/auth";

/**
 * /chats
 *
 *   GET    /                                       list (legacy array) | Page with ?limit|cursor|q
 *   POST   /                                       create {title?, bridgeIds?}
 *   DELETE /                                       delete every chat of the user
 *   GET    /:chatId                                ChatSummary
 *   PATCH  /:chatId                                {title?, pinned?, bridgeIds?}
 *   DELETE /:chatId
 *   GET    /:chatId/messages                       legacy array | Page with ?limit|before
 *   POST   /:chatId/messages                       send (SSE)
 *   POST   /:chatId/messages/:messageId/regenerate (SSE)
 *   PUT    /:chatId/messages/:messageId/feedback   {rating, note?}
 *   PUT    /:chatId/messages/:messageId/diagrams/:key  {elements, appState?, files?} (key: visual | m:<n>)
 *   DELETE /:chatId/messages/:messageId/diagrams/:key  reset to the generated diagram
 *   POST   /:chatId/stop                           202 {stopped}
 *   GET    /:chatId/export?format=md
 *   GET    /:chatId/messages/:messageId/export?format=md
 */
const router = Router();

router.use(authenticate);
objectIdParam(router, "chatId", "messageId");

router.get("/", validate({ query: ListChatsQuerySchema }), chat.listChats);
router.post("/", validate({ body: CreateChatBodySchema }), chat.createChat);
router.delete("/", chat.deleteAllChats);

router.get("/:chatId", chat.getChat);
router.patch("/:chatId", validate({ body: UpdateChatBodySchema }), chat.updateChat);
router.delete("/:chatId", chat.deleteChat);

router.get("/:chatId/messages", validate({ query: chat.ListMessagesQuerySchema }), chat.getMessages);
router.post("/:chatId/messages", chatLimiter, validate({ body: SendMessageBodySchema }), chat.sendMessage);
router.post(
  "/:chatId/messages/:messageId/regenerate",
  chatLimiter,
  validate({ body: RegenerateBodySchema }),
  chat.regenerateMessage
);
router.put("/:chatId/messages/:messageId/feedback", validate({ body: FeedbackBodySchema }), chat.setFeedback);
router.post("/:chatId/stop", chat.stopGeneration);

const DiagramParamsSchema = z.looseObject({ key: DiagramKeySchema });
router.put(
  "/:chatId/messages/:messageId/diagrams/:key",
  validate({ params: DiagramParamsSchema, body: SaveDiagramBodySchema }),
  saveDiagram
);
router.delete("/:chatId/messages/:messageId/diagrams/:key", validate({ params: DiagramParamsSchema }), resetDiagram);

router.get("/:chatId/export", validate({ query: chat.ExportQuerySchema }), chat.exportChat);
router.get("/:chatId/messages/:messageId/export", validate({ query: chat.ExportQuerySchema }), chat.exportMessage);

export default router;
