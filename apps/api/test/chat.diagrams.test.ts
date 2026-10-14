/**
 * Edited diagrams: PUT/DELETE /chats/:chatId/messages/:messageId/diagrams/:key
 */
import "./chat.env";
import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { Message } from "@wup/models";
import { FakeBrain, buildApp, clearDb, createChat, makeUser, postSse, startDb, stopDb, streamingScript } from "./chat.helpers";

const brain = new FakeBrain();
const app = buildApp(brain);

before(startDb);
after(stopDb);
beforeEach(async () => {
  await clearDb();
  brain.reset();
});

const MERMAID = "Here:\n\n```mermaid\nflowchart TD\n  A[Ask] --> B[Answer]\n```\n";

const scene = (label = "Edited") => ({
  elements: [
    { id: "r1", type: "rectangle", x: 10, y: 20, width: 120, height: 60, roughness: 0, isDeleted: false },
    { id: "t1", type: "text", x: 20, y: 40, text: label, containerId: "r1", fontFamily: 2 },
  ],
  appState: { viewBackgroundColor: "#ffffff", zoom: { value: 3 }, selectedElementIds: { r1: true } },
  files: {},
});

async function seed() {
  const owner = await makeUser();
  const chat = await createChat(app, owner.auth, { title: "Diagrams" });
  brain.script = streamingScript(MERMAID, {
    visualType: "diagram",
    diagramData: { nodes: [{ id: "a", label: "Ask", type: "start" }], edges: [] },
  });
  const { events } = await postSse(app, `/chats/${chat.id}/messages`, owner.auth, { content: "draw it" });
  const done = events.at(-1).message;
  const base = `/chats/${chat.id}/messages/${done.assistantMessage.id}/diagrams`;
  return { owner, chat, done, base };
}

describe("diagram edits", () => {
  test("owner saves, reads back via GET messages, and DELETE resets", async () => {
    const { owner, chat, done, base } = await seed();

    const put = await request(app).put(`${base}/visual`).set("Authorization", owner.auth).send(scene("Edited visual"));
    assert.equal(put.status, 200);
    assert.equal(put.body.key, "visual");
    assert.ok(!Number.isNaN(Date.parse(put.body.updatedAt)));

    const fence = await request(app).put(`${base}/${encodeURIComponent("m:0")}`).set("Authorization", owner.auth).send(scene("Edited fence"));
    assert.equal(fence.status, 200);
    assert.equal(fence.body.key, "m:0");

    const list = await request(app).get(`/chats/${chat.id}/messages`).set("Authorization", owner.auth);
    assert.equal(list.status, 200);
    const msg = list.body.find((m: any) => m.id === done.assistantMessage.id);
    assert.ok(msg.diagramEdits, "diagramEdits present");
    assert.equal(msg.diagramEdits.visual.elements[1].text, "Edited visual");
    assert.equal(msg.diagramEdits["m:0"].elements[1].text, "Edited fence");
    // appState is stripped to the safe fields.
    assert.deepEqual(msg.diagramEdits.visual.appState, { viewBackgroundColor: "#ffffff" });
    // The generated content and diagramData are untouched.
    assert.equal(msg.content, MERMAID.trim());
    assert.equal(msg.diagramData.nodes[0].label, "Ask");

    // Markdown export keeps the original mermaid.
    const md = await request(app).get(`/chats/${chat.id}/export`).query({ format: "md" }).set("Authorization", owner.auth);
    assert.equal(md.status, 200);
    assert.match(md.text, /```mermaid\nflowchart TD\n {2}A\[Ask\] --> B\[Answer\]\n```/);

    const del = await request(app).delete(`${base}/visual`).set("Authorization", owner.auth);
    assert.equal(del.status, 200);
    const after1 = await request(app).get(`/chats/${chat.id}/messages`).set("Authorization", owner.auth);
    const msg2 = after1.body.find((m: any) => m.id === done.assistantMessage.id);
    assert.equal(msg2.diagramEdits.visual, undefined);
    assert.ok(msg2.diagramEdits["m:0"]);

    await request(app).delete(`${base}/${encodeURIComponent("m:0")}`).set("Authorization", owner.auth).expect(200);
    const after2 = await request(app).get(`/chats/${chat.id}/messages`).set("Authorization", owner.auth);
    const msg3 = after2.body.find((m: any) => m.id === done.assistantMessage.id);
    assert.equal(msg3.diagramEdits, undefined);
  });

  test("another user gets 404 and cannot change the scene", async () => {
    const { owner, base, done } = await seed();
    const intruder = await makeUser();
    const put = await request(app).put(`${base}/visual`).set("Authorization", intruder.auth).send(scene());
    assert.equal(put.status, 404);
    const del = await request(app).delete(`${base}/visual`).set("Authorization", intruder.auth);
    assert.equal(del.status, 404);
    const stored: any = await Message.findById(done.assistantMessage.id).lean();
    assert.equal(stored.diagramEdits, undefined);
    // The owner still can.
    await request(app).put(`${base}/visual`).set("Authorization", owner.auth).send(scene()).expect(200);
  });

  test("the user message is not a diagram target (404)", async () => {
    const { owner, chat, done } = await seed();
    const res = await request(app)
      .put(`/chats/${chat.id}/messages/${done.userMessage.id}/diagrams/visual`)
      .set("Authorization", owner.auth)
      .send(scene());
    assert.equal(res.status, 404);
  });

  test("an oversized scene gets 413", async () => {
    const { owner, base } = await seed();
    // Under the 1mb body limit as raw JSON per element, but over the scene cap once stored.
    const big = "x".repeat(990_000);
    const res = await request(app)
      .put(`${base}/visual`)
      .set("Authorization", owner.auth)
      .send({ elements: [{ id: "t", type: "text", text: big }, { id: "u", type: "text", text: "y".repeat(20_000) }] });
    assert.equal(res.status, 413);
    assert.equal(res.body.code, "PAYLOAD_TOO_LARGE");
    // Way over the body limit is a 413 from the parser.
    const huge = await request(app)
      .put(`${base}/visual`)
      .set("Authorization", owner.auth)
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ elements: [{ id: "t", type: "text", text: "z".repeat(1_200_000) }] }));
    assert.equal(huge.status, 413);
  });

  test("bad keys and bad bodies get 400", async () => {
    const { owner, base } = await seed();
    for (const key of ["chart", "m:", "m:1234", "visual2", "m:-1"]) {
      const res = await request(app).put(`${base}/${encodeURIComponent(key)}`).set("Authorization", owner.auth).send(scene());
      assert.equal(res.status, 400, `key ${key}`);
    }
    const noElements = await request(app).put(`${base}/visual`).set("Authorization", owner.auth).send({ appState: {} });
    assert.equal(noElements.status, 400);
    const dollar = await request(app)
      .put(`${base}/visual`)
      .set("Authorization", owner.auth)
      .send({ elements: [{ id: "a", type: "rectangle", customData: { $where: "1" } }] });
    assert.equal(dollar.status, 400);
    const badFile = await request(app)
      .put(`${base}/visual`)
      .set("Authorization", owner.auth)
      .send({ elements: [], files: { f1: { id: "f1", mimeType: "text/html", dataURL: "data:text/html,<b>x</b>" } } });
    assert.equal(badFile.status, 400);
  });
});
