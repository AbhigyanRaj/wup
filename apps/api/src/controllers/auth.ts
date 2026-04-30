import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User";
import { UserPayload } from "@wup/auth";

const JWT_SECRET = process.env.JWT_SECRET || "wup_super_secret_brain_key_2026";

export const login = async (req: Request, res: Response) => {
  let { email, password } = req.body;
  
  // Handle Demo Mode
  if (email === "google-demo@wup.ai" && !password) {
    password = "demo_password_2026";
  }

  if (!password) {
    return res.status(400).json({ error: "Password is required" });
  }
  
  try {
    const user = await User.findOne({ email });
    
    if (!user) {
      // Automatic sign-up for new users
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await User.create({ email, password: hashedPassword, role: "Founder" });
      
      const payload: UserPayload = { 
        id: newUser._id.toString(), 
        email: newUser.email, 
        role: (newUser as any).role 
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
      return res.json({ token, user: payload, isNew: true });
    }

    // Verify Password
    const isMatch = await bcrypt.compare(password, (user as any).password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const payload: UserPayload = { 
      id: user._id.toString(), 
      email: (user as any).email, 
      role: (user as any).role 
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: payload });
  } catch (err) {
    console.error("[WUP API] Auth error:", err);
    res.status(500).json({ error: "Authentication failed" });
  }
};

export const verify = (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ error: "Missing token" });

  try {
    const payload = jwt.verify(token, JWT_SECRET) as UserPayload;
    res.json({ valid: true, user: payload });
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};
