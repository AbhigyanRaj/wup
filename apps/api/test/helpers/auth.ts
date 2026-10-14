/**
 * Users and credentials for tests (requires the test DB: useTestDb()).
 *
 *   const user = await createTestUser();                       // password "correct horse battery"
 *   await request(app).get("/chats").set(bearer(user));        // new-style session token
 *   await request(app).get("/chats").set(legacyBearer(user));  // { id, email, role } token
 *   const agent = cookieAgent(app, user);                      // session cookie + allowed Origin
 *   await agent.post("/chats").send({});
 *
 *   createTestUser({ isDemo: true, demoExpiresAt: new Date(Date.now() - 1000) })
 */
import "./env";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import request from "supertest";
import type express from "express";
import { User } from "@wup/models";
import { JWT_SECRET } from "../../src/config/env";
import { sessionCookieName, signToken } from "../../src/lib/session";
import { TEST_ORIGIN } from "./env";

export const TEST_PASSWORD = "correct horse battery";

let counter = 0;

export async function createTestUser(fields: Record<string, unknown> = {}): Promise<any> {
  counter++;
  const password = typeof fields.password === "string" ? fields.password : TEST_PASSWORD;
  const doc = await User.create({
    email: `user${counter}-${Date.now()}@example.com`,
    role: "Founder",
    ...fields,
    password: await bcrypt.hash(password, 4),
  });
  return doc.toObject();
}

/** New-style session token for `user`. */
export function tokenFor(user: any): string {
  return signToken(user);
}

/** Legacy `{ id, email, role }` token, as issued before sessions existed. */
export function legacyTokenFor(user: any, expiresIn: string = "7d"): string {
  return jwt.sign(
    { id: String(user._id), email: user.email, role: user.role ?? "Founder" },
    JWT_SECRET,
    { expiresIn } as jwt.SignOptions
  );
}

export function bearer(user: any): Record<string, string> {
  return { Authorization: `Bearer ${tokenFor(user)}` };
}

export function legacyBearer(user: any): Record<string, string> {
  return { Authorization: `Bearer ${legacyTokenFor(user)}` };
}

/** `Cookie` header value carrying a session for `user`. */
export function sessionCookie(user: any): string {
  return `${sessionCookieName()}=${tokenFor(user)}`;
}

/**
 * supertest agent that sends the session cookie and an allowed Origin on every
 * request (so CSRF passes). Override per request with .set("Origin", ...).
 */
export function cookieAgent(app: express.Express, user: any, origin: string = TEST_ORIGIN) {
  const agent = request.agent(app);
  agent.set("Cookie", sessionCookie(user));
  agent.set("Origin", origin);
  return agent;
}
