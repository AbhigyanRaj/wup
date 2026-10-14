import { Request, Response } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "@wup/models";
import { UserPayload } from "@wup/auth";
import { JWT_SECRET, extractBearerToken } from "../middleware/auth";

// The legacy web client logs into demo mode by posting this email with no password.
const LEGACY_DEMO_EMAIL = "google-demo@wup.ai";
const DEMO_EMAIL_DOMAIN = "demo.wuup.in";

function signToken(user: any): { token: string; user: UserPayload } {
  const payload: UserPayload = {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
  };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
  return { token, user: payload };
}

/**
 * Demo mode: every demo login gets its own isolated, throwaway user so demo
 * visitors never share bridges, documents or API keys with each other.
 */
async function createDemoUser() {
  const email = `demo-${crypto.randomUUID()}@${DEMO_EMAIL_DOMAIN}`;
  const randomPassword = crypto.randomBytes(32).toString("hex");
  const hashedPassword = await bcrypt.hash(randomPassword, 10);
  return User.create({ email, password: hashedPassword, role: "Demo" });
}

export const login = async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const { email, password } = body;

  // Only plain strings are accepted. This blocks operator injection such as
  // { "email": { "$gt": "" } } reaching the database query.
  if (typeof email !== "string" || (password !== undefined && password !== null && typeof password !== "string")) {
    return res.status(400).json({ error: "Email and password must be strings" });
  }

  const trimmedEmail = email.trim();
  const normalizedEmail = trimmedEmail.toLowerCase();

  if (!normalizedEmail) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    // Handle Demo Mode: isolated per-visitor account
    if (normalizedEmail === LEGACY_DEMO_EMAIL && !password) {
      const demoUser = await createDemoUser();
      return res.json(signToken(demoUser));
    }

    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }

    // Look up by normalised email first, then by the raw (trimmed) email to
    // keep legacy mixed-case accounts working.
    let user = await User.findOne({ email: normalizedEmail });
    if (!user && trimmedEmail !== normalizedEmail) {
      user = await User.findOne({ email: trimmedEmail });
    }

    if (!user) {
      // Automatic sign-up for new users
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await User.create({
        email: normalizedEmail,
        password: hashedPassword,
        role: "Founder",
      });
      return res.json(signToken(newUser));
    }

    // Verify Password
    const isMatch = await bcrypt.compare(password, (user as any).password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    res.json(signToken(user));
  } catch (err: any) {
    console.error("[WUP API] Auth error:", err?.message ?? err);
    res.status(500).json({ error: "Authentication failed" });
  }
};

export const verify = (req: Request, res: Response) => {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) return res.status(401).json({ error: "Missing token" });

  try {
    const payload = jwt.verify(token, JWT_SECRET) as UserPayload;
    res.json({ valid: true, user: payload });
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};
