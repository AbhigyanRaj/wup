import { Request, Response } from "express";
import { Chat } from "../models/Chat";
import { Message } from "../models/Message";
import { brain, CHAT_CONTEXT_MAX_MESSAGES, type ChatTurn } from "@wup/brain";

/**
 * Controller for managing user chat sessions and messages.
 */

export const createChat = async (req: Request, res: Response) => {
  const { title } = req.body;
  const userId = (req as any).user.id;

  try {
    const chat = await Chat.create({ userId, title });
    res.status(201).json(chat);
  } catch (err) {
    res.status(500).json({ error: "Failed to create chat" });
  }
};

export const getChats = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  try {
    const chats = await Chat.find({ userId }).sort({ lastMessageAt: -1 });
    res.json(chats);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch chats" });
  }
};

export const getMessages = async (req: Request, res: Response) => {
  const { chatId } = req.params;
  const userId = (req as any).user.id;

  try {
    // Verify chat ownership
    const chat = await Chat.findOne({ _id: chatId, userId });
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    const messages = await Message.find({ chatId }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
};

    export const saveMessage = async (req: Request, res: Response) => {
  const { chatId } = req.params;
  const { role, content, model } = req.body;
  const userId = (req as any).user.id;

  try {
    // 1. Verify and Save User Message
    const chat = await Chat.findOne({ _id: chatId, userId });
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    const userMessage = await Message.create({
      chatId,
      userId,
      role: "user",
      content
    });

    // Prior messages in this thread (exclude the message we just saved — it is sent as `prompt`)
    const priorDocs = await Message.find({
      chatId,
      _id: { $ne: userMessage._id },
    })
      .sort({ createdAt: 1 })
      .lean();

    const chatHistory: ChatTurn[] = priorDocs.slice(-CHAT_CONTEXT_MAX_MESSAGES).map((m) => ({
      role: m.role as ChatTurn["role"],
      content: m.content,
    }));

    // 2. Trigger Brain Intelligence (with conversational context and model selection)
    const brainResponse = await brain.ask(userId, content, { chatHistory, model });

    // 3. Save Assistant Message (with RAG citations if available)
    const assistantMessage = await Message.create({
      chatId,
      userId,
      role: "assistant",
      content: brainResponse.content,
      ragSources: brainResponse.ragSources ?? [],
    });

    // 4. Update chat timestamp
    chat.lastMessageAt = new Date();
    await chat.save();

    res.status(201).json({ 
      userMessage, 
      assistantMessage,
      followUps: brainResponse.followUps ?? [],
      clarification: brainResponse.clarification ?? null,
      usedModel: brainResponse.usedModel,
      exhausted: brainResponse.exhausted
    });
  } catch (err) {
    console.error("[WUP API] Chat Processing Error:", err);
    res.status(500).json({ error: "Failed to process chat" });
  }
};

export const deleteChat = async (req: Request, res: Response) => {
  const { chatId } = req.params;
  const userId = (req as any).user.id;

  try {
    const chat = await Chat.findOneAndDelete({ _id: chatId, userId });
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    // Cascading delete messages
    await Message.deleteMany({ chatId });
    
    res.json({ message: "Chat and associated messages removed" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete chat" });
  }
};
