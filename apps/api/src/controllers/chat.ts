import { Request, Response } from "express";
import { Chat } from "../models/Chat";
import { Message } from "../models/Message";
import { brain } from "@wup/brain";

const CONTEXT_WINDOW_SIZE = 10;

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
  const { role, content } = req.body;
  const userId = (req as any).user.id;

  try {
    // 1. Verify chat ownership
    const chat = await Chat.findOne({ _id: chatId, userId });
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    // 2. Save user message
    const userMessage = await Message.create({
      chatId,
      userId,
      role: "user",
      content
    });

    // 3. Fetch recent history for context (sliding window)
    const recentMessages = await Message.find({ chatId })
      .sort({ createdAt: -1 })
      .limit(CONTEXT_WINDOW_SIZE)
      .lean();

    // Reverse to chronological order — Gemini expects oldest first
    // Also exclude the message we just saved (it's the current prompt)
    const chatHistory = recentMessages
      .reverse()
      .filter(m => m._id.toString() !== userMessage._id.toString())
      .map(m => ({ role: m.role, content: m.content }));

    console.log(`[WUP API] Passing ${chatHistory.length} messages as context to Brain`);

    // 4. Trigger Brain with history
    const brainResponse = await brain.ask(userId, content, chatHistory);

    console.log("[WUP API] Brain response length:", brainResponse.content?.length);
    console.log("[WUP API] Brain response preview:", brainResponse.content?.substring(0, 150));

    // 5. Guard against empty content before saving
    const safeContent = brainResponse.content && brainResponse.content.trim()
      ? brainResponse.content
      : "I processed your request but couldn't generate a response. Please try again.";

    // 6. Save assistant message
    const assistantMessage = await Message.create({
      chatId,
      userId,
      role: "assistant",
      content: safeContent
    });

    console.log("[WUP API] Assistant message saved successfully:", assistantMessage._id);

    // 7. Update chat timestamp
    chat.lastMessageAt = new Date();
    await chat.save();

    res.status(201).json({ 
      userMessage, 
      assistantMessage 
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

    await Message.deleteMany({ chatId });
    res.json({ message: "Chat and associated messages removed" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete chat" });
  }
};