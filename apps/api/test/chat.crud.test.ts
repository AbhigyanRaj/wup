/**
 * Chat CRUD, listing (legacy arrays, cursor pagination, pin order), search,
 * message pages, feedback and markdown export.
 */
import "./chat.env";
import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { Chat, Connection, Message } from "@wup/models";
import { FakeBrain, buildApp, clearDb, createChat, makeUser, postSse, startDb, stopDb, streamingScript } from "./chat.helpers";
import { toMessageDTO } from "../src/dto/message";

const brain = new FakeBrain();
const app = buildApp(brain);

before(startDb);
after(stopDb);
beforeEach(async () => {
  await clearDb();
  brain.reset();
});

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000);

async function seedChats(userId: string, specs: Array<{ title: string; ago: number; pinned?: boolean }>) {
  const out: any[] = [];
  for (const s of specs) {
    out.push(
      await Chat.create({ userId, title: s.title, pinned: !!s.pinned, lastMessageAt: minutesAgo(s.ago), createdAt: minutesAgo(s.ago + 1) })
    );
  }
  return out;
}

describe("create / get / patch / delete", () => {
  test("create without a title is an auto-titled 'New chat'; bridgeIds are filtered to owned ones", async () => {
    const { auth, user } = await makeUser();
    const other = await makeUser();
    const mine: any = await Connection.collection.insertOne({ userId: user._id, name: "Mine", type: "mongodb", config: "x" });
    const theirs: any = await Connection.collection.insertOne({ userId: other.user._id, name: "Theirs", type: "mongodb", config: "x" });

    const res = await request(app)
      .post("/chats")
      .set("Authorization", auth)
      .send({ bridgeIds: [String(mine.insertedId), String(theirs.insertedId)] });
    assert.equal(res.status, 201);
    assert.equal(res.body.title, "New chat");
    assert.equal(res.body.titleSource, "auto");
    assert.equal(res.body.pinned, false);
    assert.equal(res.body.messageCount, 0);
    assert.equal(res.body.id, res.body._id);
    assert.deepEqual(res.body.bridgeIds, [String(mine.insertedId)]);

    const got = await request(app).get(`/chats/${res.body.id}`).set("Authorization", auth);
    assert.equal(got.status, 200);
    assert.equal(got.body.title, "New chat");

    const foreign = await request(app).get(`/chats/${res.body.id}`).set("Authorization", other.auth);
    assert.equal(foreign.status, 404);
  });

  test("patch title makes it a user title; pinned toggles", async () => {
    const { auth } = await makeUser();
    const chat = await createChat(app, auth);
    const res = await request(app).patch(`/chats/${chat.id}`).set("Authorization", auth).send({ title: "Renamed", pinned: true });
    assert.equal(res.status, 200);
    assert.equal(res.body.title, "Renamed");
    assert.equal(res.body.titleSource, "user");
    assert.equal(res.body.pinned, true);
    const bad = await request(app).patch(`/chats/${chat.id}`).set("Authorization", auth).send({ title: "" });
    assert.equal(bad.status, 400);
  });

  test("delete one chat removes its messages; delete all removes everything for the user only", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const c1 = await createChat(app, a.auth, { title: "One" });
    const c2 = await createChat(app, a.auth, { title: "Two" });
    const cb = await createChat(app, b.auth, { title: "Other user" });
    await postSse(app, `/chats/${c1.id}/messages`, a.auth, { content: "hi" });
    await postSse(app, `/chats/${c2.id}/messages`, a.auth, { content: "hi" });
    await postSse(app, `/chats/${cb.id}/messages`, b.auth, { content: "hi" });

    const one = await request(app).delete(`/chats/${c1.id}`).set("Authorization", a.auth);
    assert.equal(one.status, 200);
    assert.equal(await Message.countDocuments({ chatId: c1.id }), 0);
    assert.equal(await Message.countDocuments({ chatId: c2.id }), 2);

    const all = await request(app).delete("/chats").set("Authorization", a.auth);
    assert.equal(all.status, 200);
    assert.equal(all.body.deleted, 1);
    assert.equal(await Chat.countDocuments({ userId: a.id }), 0);
    assert.equal(await Message.countDocuments({ userId: a.id }), 0);
    assert.equal(await Chat.countDocuments({ userId: b.id }), 1);
    assert.equal(await Message.countDocuments({ chatId: cb.id }), 2);
  });
});

describe("listing", () => {
  test("legacy GET /chats returns a plain array, pinned first", async () => {
    const { auth, id } = await makeUser();
    await seedChats(id, [
      { title: "old pinned", ago: 100, pinned: true },
      { title: "newest", ago: 1 },
      { title: "middle", ago: 50 },
    ]);
    const res = await request(app).get("/chats").set("Authorization", auth);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.deepEqual(res.body.map((c: any) => c.title), ["old pinned", "newest", "middle"]);
    assert.ok(res.body.every((c: any) => c._id && c.id === c._id));
  });

  test("cursor pagination walks every chat once in pin/recency order", async () => {
    const { auth, id } = await makeUser();
    const same = minutesAgo(30);
    await seedChats(id, [
      { title: "p1", ago: 5, pinned: true },
      { title: "p2", ago: 90, pinned: true },
      { title: "c1", ago: 1 },
      { title: "c2", ago: 10 },
      { title: "c5", ago: 200 },
    ]);
    // Two chats with the same lastMessageAt: _id breaks the tie
    await Chat.create({ userId: id, title: "t1", lastMessageAt: same });
    await Chat.create({ userId: id, title: "t2", lastMessageAt: same });

    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const res: any = await request(app)
        .get("/chats")
        .query(cursor ? { limit: 2, cursor } : { limit: 2 })
        .set("Authorization", auth);
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.items));
      assert.ok(res.body.items.length <= 2);
      seen.push(...res.body.items.map((c: any) => c.title));
      cursor = res.body.nextCursor;
      pages += 1;
    } while (cursor && pages < 10);

    assert.deepEqual(seen, ["p1", "p2", "c1", "c2", "t2", "t1", "c5"]);
    assert.equal(pages, 4);

    const bad = await request(app).get("/chats").query({ cursor: "not-a-cursor" }).set("Authorization", auth);
    assert.equal(bad.status, 400);
    const tooBig = await request(app).get("/chats").query({ limit: 51 }).set("Authorization", auth);
    assert.equal(tooBig.status, 400);
  });

  test("search matches titles and message text, scoped to the user", async () => {
    const { auth, id } = await makeUser();
    const other = await makeUser();
    const [budget, , notes] = await seedChats(id, [
      { title: "Budget planning", ago: 5 },
      { title: "Random", ago: 6 },
      { title: "Notes", ago: 7 },
    ]);
    await Message.create({ chatId: notes._id, userId: id, role: "assistant", content: "The quarterly budget forecast looks strong this year." });
    const foreignChat = await Chat.create({ userId: other.id, title: "Budget secrets" });
    await Message.create({ chatId: foreignChat._id, userId: other.id, role: "user", content: "budget budget budget" });

    // The {userId, content:"text"} index exists, so this exercises $text (not the regex fallback)
    const indexes = await Message.collection.indexes();
    assert.ok(indexes.some((i: any) => i.key && i.key._fts === "text"));

    const res = await request(app).get("/chats").query({ q: "budget" }).set("Authorization", auth);
    assert.equal(res.status, 200);
    assert.equal(res.body.nextCursor, null);
    const titles = res.body.items.map((c: any) => c.title);
    assert.deepEqual(titles.sort(), ["Budget planning", "Notes"]);
    const viaTitle = res.body.items.find((c: any) => c.id === String(budget._id));
    assert.equal(viaTitle.match.messageId, null);
    const viaText = res.body.items.find((c: any) => c.id === String(notes._id));
    assert.ok(viaText.match.messageId);
    assert.match(viaText.match.snippet, /budget forecast/);

    const regexSafe = await request(app).get("/chats").query({ q: "(.*" }).set("Authorization", auth);
    assert.equal(regexSafe.status, 200);
    assert.deepEqual(regexSafe.body.items, []);
  });

  test("messages: legacy array without params, chronological pages with limit/before", async () => {
    const { auth, id } = await makeUser();
    const chat = await createChat(app, auth, { title: "Paged" });
    for (let i = 0; i < 5; i++) {
      await Message.create({ chatId: chat.id, userId: id, role: i % 2 ? "assistant" : "user", content: `m${i}`, createdAt: minutesAgo(10 - i) });
    }
    const legacy = await request(app).get(`/chats/${chat.id}/messages`).set("Authorization", auth);
    assert.ok(Array.isArray(legacy.body));
    assert.deepEqual(legacy.body.map((m: any) => m.content), ["m0", "m1", "m2", "m3", "m4"]);

    const p1 = await request(app).get(`/chats/${chat.id}/messages`).query({ limit: 2 }).set("Authorization", auth);
    assert.deepEqual(p1.body.items.map((m: any) => m.content), ["m3", "m4"]);
    assert.ok(p1.body.nextCursor);
    const p2 = await request(app).get(`/chats/${chat.id}/messages`).query({ limit: 2, before: p1.body.nextCursor }).set("Authorization", auth);
    assert.deepEqual(p2.body.items.map((m: any) => m.content), ["m1", "m2"]);
    const p3 = await request(app).get(`/chats/${chat.id}/messages`).query({ limit: 2, before: p2.body.nextCursor }).set("Authorization", auth);
    assert.deepEqual(p3.body.items.map((m: any) => m.content), ["m0"]);
    assert.equal(p3.body.nextCursor, null);
  });
});

describe("feedback", () => {
  test("set and clear", async () => {
    const { auth } = await makeUser();
    const chat = await createChat(app, auth, { title: "Feedback" });
    const { events } = await postSse(app, `/chats/${chat.id}/messages`, auth, { content: "hi" });
    const done = events.at(-1).message;
    const url = `/chats/${chat.id}/messages/${done.assistantMessage.id}/feedback`;

    const up = await request(app).put(url).set("Authorization", auth).send({ rating: "up", note: "Great" });
    assert.equal(up.status, 200);
    assert.equal(up.body.feedback.rating, "up");
    assert.equal(up.body.feedback.note, "Great");
    let stored: any = await Message.findById(done.assistantMessage.id).lean();
    assert.equal(stored.feedback.rating, "up");
    assert.ok(stored.feedback.at instanceof Date);

    const cleared = await request(app).put(url).set("Authorization", auth).send({ rating: null });
    assert.equal(cleared.status, 200);
    assert.equal(cleared.body.feedback, null);
    stored = await Message.findById(done.assistantMessage.id).lean();
    assert.equal(stored.feedback, null);

    const bad = await request(app).put(url).set("Authorization", auth).send({ rating: "meh" });
    assert.equal(bad.status, 400);
    const onUser = await request(app)
      .put(`/chats/${chat.id}/messages/${done.userMessage.id}/feedback`)
      .set("Authorization", auth)
      .send({ rating: "up" });
    assert.equal(onUser.status, 404);
  });
});

describe("markdown export", () => {
  test("chat and single message export", async () => {
    const { auth, id } = await makeUser();
    const chat = await createChat(app, auth, { title: "Sales Report: Q3 / 2025!" });
    brain.script = streamingScript("Sales were up [1].", {
      queries: [{ tool: "mongo_aggregate", connectionName: "Prod", db: "shop", collection: "orders", query: '[{"$match":{"q":3}}]', rowCount: 2, truncated: false, durationMs: 4 }],
      tableData: { columns: ["region", "total"], rows: Array.from({ length: 60 }, (_, i) => ({ region: i === 0 ? "North|East" : `R${i}`, total: i })) },
      visualType: "table",
      sources: [{ n: 1, kind: "web", title: "Example", cited: true, url: "https://example.com/a", snippet: null }],
    });
    const { events } = await postSse(app, `/chats/${chat.id}/messages`, auth, { content: "How were sales?" });
    const done = events.at(-1).message;
    await Message.updateOne(
      { _id: done.assistantMessage.id },
      { $set: { research: { steps: [{ id: "s1", title: "Plan the research", status: "done", detail: "3 questions" }], durationMs: 10 } } }
    );

    const res = await request(app).get(`/chats/${chat.id}/export`).query({ format: "md" }).set("Authorization", auth);
    assert.equal(res.status, 200);
    assert.match(String(res.headers["content-type"]), /text\/markdown/);
    assert.equal(res.headers["content-disposition"], 'attachment; filename="sales-report-q3-2025.md"');
    const md = res.text;
    assert.match(md, /^# Sales Report: Q3 \/ 2025!/);
    assert.match(md, /Exported from wuup on \d{4}-\d{2}-\d{2}/);
    assert.match(md, /### You\n\nHow were sales\?/);
    assert.match(md, /### wuup\n\nSales were up \[1\]\./);
    assert.match(md, /```json\n\[\{"\$match":\{"q":3\}\}\]\n```/);
    assert.match(md, /\| region \| total \|\n\| --- \| --- \|\n\| North\\\|East \| 0 \|/);
    assert.equal((md.match(/^\| R\d+ \|/gm) ?? []).length, 49, "tables are capped at 50 rows");
    assert.match(md, /10 more rows not shown/);
    assert.match(md, /1\. Plan the research \(done\): 3 questions/);
    assert.match(md, /\*\*Sources\*\*\n\n1\. \[Example\]\(https:\/\/example\.com\/a\)/);
    assert.ok(!md.includes("—"), "no em dashes");

    const one = await request(app)
      .get(`/chats/${chat.id}/messages/${done.assistantMessage.id}/export`)
      .query({ format: "md" })
      .set("Authorization", auth);
    assert.equal(one.status, 200);
    assert.match(String(one.headers["content-disposition"]), /attachment; filename="sales-report-q3-2025-[a-f0-9]{6}\.md"/);
    assert.match(one.text, /### You\n\nHow were sales\?/);
    assert.match(one.text, /### wuup/);

    const badFormat = await request(app).get(`/chats/${chat.id}/export`).query({ format: "pdf" }).set("Authorization", auth);
    assert.equal(badFormat.status, 400);
    const other = await makeUser();
    const foreign = await request(app).get(`/chats/${chat.id}/export`).set("Authorization", other.auth);
    assert.equal(foreign.status, 404);
    void id;
  });
});

describe("DTO normalisation", () => {
  test("legacy documents get sources, defaults, id and _id", async () => {
    const { id } = await makeUser();
    const chat = await Chat.create({ userId: id, title: "Legacy" });
    // Raw insert: no status, mode, sources (as stored before v2)
    const raw = await Message.collection.insertOne({
      chatId: chat._id,
      userId: chat.userId,
      role: "assistant",
      content: "Old answer",
      ragSources: [{ sourceFile: "a.pdf", pageNumber: 3, score: 0.5, text: "y".repeat(500) }],
      webSources: [{ title: "W", url: "https://w.example" }],
      createdAt: new Date(),
    } as any);
    const doc = await Message.findById(raw.insertedId).lean();
    const dto = toMessageDTO(doc);
    assert.equal(dto.id, String(raw.insertedId));
    assert.equal(dto._id, dto.id);
    assert.equal(dto.status, "complete");
    assert.equal(dto.mode, "chat");
    assert.equal(dto.chartData, null);
    assert.equal(dto.tableData, null);
    assert.equal(dto.diagramData, null);
    assert.equal(dto.sources.length, 2);
    assert.equal(dto.sources[0].kind, "doc");
    assert.equal((dto.sources[0] as any).snippet.length, 300);
    assert.equal(dto.sources[1].kind, "web");
    assert.equal(dto.sources[1].n, 2);
    assert.equal(dto.ragSources![0].sourceFile, "a.pdf");
    assert.equal(dto.webSources![0].url, "https://w.example");
  });
});
