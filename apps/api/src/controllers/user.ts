import { Request, Response } from "express";
import { User } from "../models/User";

export const updateApiKey = async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const { apiKey, provider } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: "API key is required" });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    (user as any).customApiKey = apiKey;
    if (provider) {
      (user as any).customApiProvider = provider;
    }
    await user.save();

    res.json({ success: true, message: "API key updated successfully" });
  } catch (err) {
    console.error("[WUP API] Update API key error:", err);
    res.status(500).json({ error: "Failed to update API key" });
  }
};

export const getUsage = async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const u = user as any;
    res.json({
      freeTierUsage: u.freeTierUsage,
      freeTierLimit: u.freeTierLimit,
      hasCustomKey: !!u.customApiKey,
      provider: u.customApiProvider
    });
  } catch (err) {
    console.error("[WUP API] Get usage error:", err);
    res.status(500).json({ error: "Failed to get usage stats" });
  }
};
