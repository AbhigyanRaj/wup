import { z } from "zod";
import { ObjectIdSchema, type CreateChatBody, type Page, type MessageDTO, type UpdateChatBody } from "@wup/contracts";
import { Chat, Connection, Message } from "@wup/models";
import { DEFAULT_CHAT_TITLE, toChatSummary } from "../../dto/chat";
import { toMessageDTO } from "../../dto/message";
import { stopChat } from "../../lib/inflight";
import { asyncHandler, getUserId, notFound, validatedQuery } from "./deps";

/**
 * Chat CRUD and message history.
 *
 * Compatibility: responses carry `_id` next to `id`, and list endpoints return
 * a plain array unless pagination params are sent (the pre-v2 web client
 * expects arrays).
 */

/** Keeps only bridges the user owns (unknown or foreign ids are dropped, as before). */
async function ownedBridgeIds(userId: string, ids: string[]) {
  if (ids.length === 0) return [];
  const owned = await Connection.find({ _id: { $in: ids }, userId }).select("_id").lean();
  const ownedSet = new Set(owned.map((c: any) => String(c._id)));
  return [...new Set(ids)].filter((id) => ownedSet.has(id));
}

async function findOwnedChat(chatId: string, userId: string): Promise<any> {
  const chat = await Chat.findOne({ _id: chatId, userId }).lean();
  if (!chat) throw notFound("Chat");
  return chat;
}

/** POST /chats. No title: "New chat" + titleSource "auto" (replaced by the generated title). */
export const createChat = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const body = req.body as CreateChatBody;
  const title = body.title?.trim();
  const bridgeIds = body.bridgeIds ? await ownedBridgeIds(userId, body.bridgeIds) : [];
  const now = new Date();
  const chat = await Chat.create({
    userId,
    title: title || DEFAULT_CHAT_TITLE,
    titleSource: title ? "user" : "auto",
    pinned: false,
    messageCount: 0,
    bridgeIds,
    lastMessageAt: now,
    createdAt: now,
  });
  res.status(201).json(toChatSummary(chat));
});

/** GET /chats/:chatId */
export const getChat = asyncHandler(async (req, res) => {
  const chat = await findOwnedChat(req.params.chatId, getUserId(req));
  res.json(toChatSummary(chat));
});

/** PATCH /chats/:chatId. title (becomes a user title), pinned, bridgeIds (owned only). */
export const updateChat = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { chatId } = req.params;
  const body = req.body as UpdateChatBody;
  await findOwnedChat(chatId, userId);

  const set: Record<string, unknown> = {};
  if (body.title !== undefined) {
    set.title = body.title;
    set.titleSource = "user";
  }
  if (body.pinned !== undefined) set.pinned = body.pinned;
  if (body.bridgeIds !== undefined) set.bridgeIds = await ownedBridgeIds(userId, body.bridgeIds);

  const chat = Object.keys(set).length
    ? await Chat.findOneAndUpdate({ _id: chatId, userId }, { $set: set }, { new: true }).lean()
    : await Chat.findOne({ _id: chatId, userId }).lean();
  if (!chat) throw notFound("Chat");
  res.json(toChatSummary(chat));
});

/** DELETE /chats/:chatId (and its messages). */
export const deleteChat = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { chatId } = req.params;
  const chat = await Chat.findOneAndDelete({ _id: chatId, userId });
  if (!chat) throw notFound("Chat");
  stopChat(chatId, userId);
  await Message.deleteMany({ chatId });
  res.json({ message: "Chat and associated messages removed", deleted: true });
});

/** DELETE /chats: every chat and message of the user. */
export const deleteAllChats = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const chats = await Chat.find({ userId }).select("_id").lean();
  for (const c of chats) stopChat(String(c._id), userId);
  const chatIds = chats.map((c: any) => c._id);
  const [chatRes] = await Promise.all([
    Chat.deleteMany({ userId }),
    Message.deleteMany({ $or: [{ userId }, { chatId: { $in: chatIds } }] }),
  ]);
  res.json({ deleted: chatRes.deletedCount ?? 0 });
});

export const ListMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  /** Message id: returns messages older than this one. */
  before: ObjectIdSchema.optional(),
});
type ListMessagesQuery = z.infer<typeof ListMessagesQuerySchema>;

/**
 * GET /chats/:chatId/messages?limit&before
 * With limit/before: Page<MessageDTO> in chronological order, nextCursor = id
 * to pass as `before` for older messages. Without: the legacy plain array.
 */
export const getMessages = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { chatId } = req.params;
  await findOwnedChat(chatId, userId);
  const q = validatedQuery<ListMessagesQuery>(req);
  const base = { chatId, role: { $in: ["user", "assistant"] } };

  if (q.limit === undefined && q.before === undefined) {
    const all = await Message.find(base).sort({ createdAt: 1, _id: 1 }).lean();
    return res.json(all.map(toMessageDTO));
  }

  const limit = q.limit ?? 50;
  const filter: Record<string, unknown> = { ...base };
  if (q.before) {
    const pivot: any = await Message.findOne({ _id: q.before, chatId }).select("createdAt").lean();
    if (!pivot) throw notFound("Message");
    filter.$or = [{ createdAt: { $lt: pivot.createdAt } }, { createdAt: pivot.createdAt, _id: { $lt: pivot._id } }];
  }
  const docs = await Message.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).lean();
  const hasMore = docs.length > limit;
  const pageDocs = docs.slice(0, limit).reverse();
  const page: Page<MessageDTO> = {
    items: pageDocs.map(toMessageDTO),
    nextCursor: hasMore && pageDocs.length ? String(pageDocs[0]._id) : null,
  };
  res.json(page);
});
