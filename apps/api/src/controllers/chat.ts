import { Request, Response } from "express";
import { Chat } from "../models/Chat";
import { Message } from "../models/Message";
import { brain } from "@wup/brain";

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
  const { role, content } = req.body;
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

    // 2. Trigger Brain Intelligence
    const brainResponse = await brain.ask(userId, content);

    // 3. Save Assistant Message
    const assistantMessage = await Message.create({
      chatId,
      userId,
      role: "assistant",
      content: brainResponse.content
    });

    // 4. Update chat timestamp
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

    // Cascading delete messages
    await Message.deleteMany({ chatId });
    
    res.json({ message: "Chat and associated messages removed" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete chat" });
  }
};
