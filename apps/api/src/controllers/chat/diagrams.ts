import { MAX_DIAGRAM_SCENE_BYTES, type SaveDiagramBody } from "@wup/contracts";
import { Chat, Message } from "@wup/models";
import { findForbiddenKey } from "../../middleware/rejectOperators";
import { asyncHandler, getUserId, httpError, notFound } from "./deps";

/**
 * Edited diagrams (Excalidraw scenes) on an assistant message.
 *
 *   PUT    /chats/:chatId/messages/:messageId/diagrams/:key   {elements, appState?, files?} -> {key, updatedAt}
 *   DELETE /chats/:chatId/messages/:messageId/diagrams/:key   reset to the generated version -> {key, reset: true}
 *
 * key is "visual" (the message's diagramData) or "m:<n>" (the n-th mermaid
 * fence). The generated diagram is never touched, so exports keep the original.
 */

async function ownedAssistant(userId: string, chatId: string, messageId: string) {
  const chat = await Chat.exists({ _id: chatId, userId });
  if (!chat) throw notFound("Chat");
  const msg = await Message.exists({ _id: messageId, chatId, role: "assistant" });
  if (!msg) throw notFound("Message");
}

export const saveDiagram = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { chatId, messageId, key } = req.params as { chatId: string; messageId: string; key: string };
  const body = req.body as SaveDiagramBody;

  // This path skips the global "$" key guard (chat content routes are free
  // form), so check the scene here: it is stored as Mixed.
  const bad = findForbiddenKey(body);
  if (bad) {
    throw httpError(400, "VALIDATION_FAILED", "Invalid diagram: keys may not start with \"$\".", {
      details: [{ path: bad, message: "Forbidden key" }],
    });
  }

  const scene = {
    elements: body.elements,
    appState: {
      ...(body.appState?.viewBackgroundColor ? { viewBackgroundColor: body.appState.viewBackgroundColor } : {}),
      ...(typeof body.appState?.gridSize === "number" ? { gridSize: body.appState.gridSize } : {}),
    },
    files: body.files ?? {},
  };
  if (Buffer.byteLength(JSON.stringify(scene)) > MAX_DIAGRAM_SCENE_BYTES) {
    throw httpError(413, "PAYLOAD_TOO_LARGE", "This diagram is too large to save. Remove some shapes or images and try again.");
  }

  await ownedAssistant(userId, chatId, messageId);
  const updatedAt = new Date();
  await Message.updateOne(
    { _id: messageId, chatId, role: "assistant" },
    { $set: { [`diagramEdits.${key}`]: { ...scene, updatedAt } } },
    { strict: false }
  );
  res.json({ key, updatedAt: updatedAt.toISOString() });
});

export const resetDiagram = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { chatId, messageId, key } = req.params as { chatId: string; messageId: string; key: string };
  await ownedAssistant(userId, chatId, messageId);
  await Message.updateOne({ _id: messageId, chatId, role: "assistant" }, { $unset: { [`diagramEdits.${key}`]: 1 } });
  res.json({ key, reset: true });
});
