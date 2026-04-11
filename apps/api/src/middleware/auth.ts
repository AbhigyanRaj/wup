import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UserPayload } from "@wup/auth";

const JWT_SECRET = process.env.JWT_SECRET || "wup_super_secret_brain_key_2026";

/**
 * Middleware to protect routes by verifying the JWT token.
 * Attaches the user payload to the request object.
 */
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as UserPayload;
    (req as any).user = payload;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token." });
  }
};
