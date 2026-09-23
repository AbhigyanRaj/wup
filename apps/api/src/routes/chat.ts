import { Router } from "express";
import * as chatController from "../controllers/chat";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { saveMessageSchema, updateChatSchema } from "../validation/schemas";

const router = Router();

router.use(authenticate);

router.post("/", chatController.createChat);
router.get("/", chatController.getChats);
router.get("/:chatId/messages", chatController.getMessages);
router.post("/:chatId/messages", validate(saveMessageSchema), chatController.saveMessage);
router.patch("/:chatId", validate(updateChatSchema), chatController.updateChat);
router.delete("/:chatId", chatController.deleteChat);

export default router;
