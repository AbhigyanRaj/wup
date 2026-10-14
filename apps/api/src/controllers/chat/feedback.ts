import type { FeedbackBody } from "@wup/contracts";
import { Chat, Message } from "@wup/models";
import { toMessageDTO } from "../../dto/message";
import { asyncHandler, getUserId, notFound } from "./deps";

/**
 * PUT /chats/:chatId/messages/:messageId/feedback
 * Body {rating: "up" | "down" | null, note?}. null clears the feedback.
 * Returns the updated MessageDTO.
 */
export const setFeedback = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { chatId, messageId } = req.params;
  const body = req.body as FeedbackBody;

  const chat = await Chat.exists({ _id: chatId, userId });
  if (!chat) throw notFound("Chat");

  const update =
    body.rating === null
      ? { $set: { feedback: null } }
      : { $set: { feedback: { rating: body.rating, ...(body.note ? { note: body.note } : {}), at: new Date() } } };

  const msg = await Message.findOneAndUpdate({ _id: messageId, chatId, role: "assistant" }, update, {
    new: true,
    runValidators: true,
  }).lean();
  if (!msg) throw notFound("Message");
  res.json(toMessageDTO(msg));
});
