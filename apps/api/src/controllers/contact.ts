/**
 * Public contact form. Messages are stored in ContactMessage; logs carry a
 * hashed IP only, never the message or email.
 */
import type { Request, Response } from "express";
import { ContactMessage } from "@wup/models";
import type { ContactBody } from "@wup/contracts";
import { logger } from "../lib/logger";
import { hashIp } from "./publicTools";

export async function createContactMessage(req: Request, res: Response) {
  const body = req.body as ContactBody;
  const doc = await ContactMessage.create({
    name: body.name,
    email: body.email,
    topic: body.topic,
    message: body.message,
  });
  ((req as any).log ?? logger).info({ mod: "contact", ip: hashIp(req.ip), id: String(doc._id) }, "contact message stored");
  res.status(201).json({ ok: true });
}
