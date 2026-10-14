/**
 * Migration 004-backfill-chats-messages: backfills and idempotency.
 */
import "./chat.env";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { Chat, Message } from "@wup/models";
import { startDb, stopDb } from "./chat.helpers";
import migration from "../src/migrations/004-backfill-chats-messages";

before(startDb);
after(stopDb);

const silent = { log: { info: () => undefined } };

test("backfills chats and messages, and a second run changes nothing", async () => {
  const userId = new mongoose.Types.ObjectId();
  const chatId = new mongoose.Types.ObjectId();
  const emptyChatId = new mongoose.Types.ObjectId();
  const t = (s: number) => new Date(Date.UTC(2025, 0, 1, 0, 0, s));

  // Pre-v2 shapes, written raw so no schema defaults apply
  await Chat.collection.insertMany([
    { _id: chatId, userId, title: "Old chat", lastMessageAt: t(0), createdAt: t(0) },
    { _id: emptyChatId, userId, title: "Empty", lastMessageAt: t(0), createdAt: t(0) },
  ] as any[]);
  const q1 = new mongoose.Types.ObjectId();
  const a1 = new mongoose.Types.ObjectId();
  const q2 = new mongoose.Types.ObjectId();
  const a2 = new mongoose.Types.ObjectId();
  await Message.collection.insertMany([
    { _id: q1, chatId, userId, role: "user", content: "first", createdAt: t(1) },
    {
      _id: a1,
      chatId,
      userId,
      role: "assistant",
      content: "answer",
      ragSources: [{ sourceFile: "doc.pdf", pageNumber: 4, score: 0.7, text: "z".repeat(400) }],
      webSources: [{ title: "Site", url: "https://site.example" }],
      createdAt: t(2),
    },
    { _id: q2, chatId, userId, role: "user", content: "second", createdAt: t(3) },
    { _id: a2, chatId, userId, role: "assistant", content: "answer 2", ragSources: [], webSources: [], createdAt: t(4) },
  ] as any[]);

  await migration.up(silent);

  const chat: any = await Chat.collection.findOne({ _id: chatId });
  assert.equal(chat.pinned, false);
  assert.equal(chat.titleSource, "user");
  assert.equal(chat.messageCount, 4);
  assert.equal(chat.lastMessageAt.getTime(), t(4).getTime());
  const empty: any = await Chat.collection.findOne({ _id: emptyChatId });
  assert.equal(empty.messageCount, 0);
  assert.equal(empty.pinned, false);

  const m1: any = await Message.collection.findOne({ _id: a1 });
  assert.equal(m1.status, "complete");
  assert.equal(m1.mode, "chat");
  assert.equal(String(m1.parentId), String(q1));
  assert.equal(m1.sources.length, 2);
  assert.deepEqual(
    m1.sources.map((s: any) => [s.n, s.kind, s.title]),
    [
      [1, "doc", "doc.pdf"],
      [2, "web", "Site"],
    ]
  );
  assert.equal(m1.sources[0].snippet.length, 300);
  assert.equal(m1.sources[0].page, 4);
  assert.equal(m1.ragSources.length, 1, "legacy arrays are kept");
  const m2: any = await Message.collection.findOne({ _id: a2 });
  assert.equal(String(m2.parentId), String(q2));
  const u1: any = await Message.collection.findOne({ _id: q1 });
  assert.equal(u1.parentId, undefined, "user messages get no parentId");

  // The migrated documents validate against the current schema
  const hydrated = await Message.findById(a1);
  await hydrated!.validate();

  // Idempotent: snapshot, run again, compare
  const before = JSON.stringify(await Message.collection.find().sort({ _id: 1 }).toArray()) + JSON.stringify(await Chat.collection.find().sort({ _id: 1 }).toArray());
  await migration.up(silent);
  const afterRun = JSON.stringify(await Message.collection.find().sort({ _id: 1 }).toArray()) + JSON.stringify(await Chat.collection.find().sort({ _id: 1 }).toArray());
  assert.equal(afterRun, before);
});
