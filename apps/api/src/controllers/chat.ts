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
  const { role, content, model, searchWeb } = req.body;
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

    // Setup SSE Headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // Send headers immediately

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

    // 2. Trigger Brain Intelligence (with streaming)
    const stream = brain.askStream(userId, content, {
      chatHistory,
      model,
      searchWeb,
      onStatus: (message: string) => {
        res.write(`data: ${JSON.stringify({ type: "status", message })}\n\n`);
      }
    });

    let fullContent = "";
    let finalMetadata: any = null;

    for await (const chunk of stream) {
      if (typeof chunk === "string") {
        fullContent += chunk;
        res.write(`data: ${JSON.stringify({ type: "token", text: chunk })}\n\n`);
      } else if (typeof chunk === "object" && chunk !== null && 'type' in chunk && chunk.type === "done") {
        finalMetadata = (chunk as any).data;
      }
    }

    // 3. Save Assistant Message (with citations if available)
    const assistantMessage = await Message.create({
      chatId,
      userId,
      role: "assistant",
      content: finalMetadata?.content ?? fullContent,
      ragSources: finalMetadata?.ragSources ?? [],
      webSources: finalMetadata?.webSources ?? [],
      visualType: finalMetadata?.visualType ?? "none",
      chartData: finalMetadata?.chartData ?? null,
      tableData: finalMetadata?.tableData ?? null,
      diagramData: finalMetadata?.diagramData ?? null,
    });

    // 4. Update chat timestamp
    chat.lastMessageAt = new Date();
    await chat.save();

    res.write(`data: ${JSON.stringify({ 
      type: "done", 
      message: {
        userMessage, 
        assistantMessage,
        followUps: finalMetadata?.followUps ?? [],
        clarification: finalMetadata?.clarification ?? null,
        usedModel: finalMetadata?.usedModel,
        exhausted: finalMetadata?.exhausted
      }
    })}\n\n`);
    res.end();
  } catch (err) {
    console.error("[WUP API] Chat Processing Error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to process chat" });
    } else {
      res.write(`data: ${JSON.stringify({ type: "error", message: "Failed to process chat" })}\n\n`);
      res.end();
    }
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
