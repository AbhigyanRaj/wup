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

    let availableModels: string[] = [];

    // Validate the API key and fetch models
    if (provider === "gemini" || !provider) {
      const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (!modelsRes.ok) {
        return res.status(400).json({ error: "Invalid API key or unable to reach provider" });
      }
      const modelsData = await modelsRes.json();
      
      availableModels = modelsData.models
        ?.filter((m: any) => m.supportedGenerationMethods?.includes("generateContent") || m.supportedGenerationMethods?.includes("bidiGenerateContent"))
        ?.map((m: any) => m.name.replace("models/", ""))
        || [];

      // Optional: Check if server location is blocked by doing a dummy query
      const testReq = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: "hi" }] }] })
      });
      const testRes = await testReq.json();
      if (testRes.error && testRes.error.message.includes("User location")) {
        return res.status(400).json({ 
          error: "API key is valid, but Google restricts API access from this server's region (Singapore). Please deploy to a US region." 
        });
      }
    } else if (provider === "openrouter") {
      const modelsRes = await fetch("https://openrouter.ai/api/v1/models", {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": "https://wuup.ai",
          "X-Title": "Wuup"
        }
      });
      if (!modelsRes.ok) {
        return res.status(400).json({ error: "Invalid OpenRouter API key or unable to reach provider" });
      }
      const modelsData = await modelsRes.json();
      availableModels = modelsData.data?.map((m: any) => m.id) || [];
    } else if (provider === "openai") {
      const modelsRes = await fetch("https://api.openai.com/v1/models", {
        headers: {
          "Authorization": `Bearer ${apiKey}`
        }
      });
      if (!modelsRes.ok) {
        return res.status(400).json({ error: "Invalid OpenAI API key or unable to reach provider" });
      }
      const modelsData = await modelsRes.json();
      availableModels = modelsData.data?.map((m: any) => m.id) || [];
    } else if (provider === "anthropic") {
      const testRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }]
        })
      });
      if (!testRes.ok && testRes.status !== 400 && testRes.status !== 402) {
        const errData = await testRes.json().catch(() => ({}));
        if (testRes.status === 401) {
          return res.status(400).json({ error: "Invalid Anthropic API key" });
        }
        return res.status(400).json({ error: errData.error?.message || "Invalid Anthropic API key or unable to reach provider" });
      }
      availableModels = ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"];
    }

    (user as any).customApiKey = apiKey;
    if (provider) {
      (user as any).customApiProvider = provider;
    }
    if (availableModels.length > 0) {
      (user as any).availableModels = availableModels;
    }
    await user.save();

    res.json({ success: true, message: "API key updated successfully", availableModels });
  } catch (err) {
    console.error("[WUP API] Update API key error:", err);
    res.status(500).json({ error: "Failed to update API key" });
  }
};

export const deleteApiKey = async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    (user as any).customApiKey = undefined;
    (user as any).customApiProvider = undefined;
    (user as any).availableModels = [];
    await user.save();

    res.json({ success: true, message: "API key deleted successfully" });
  } catch (err) {
    console.error("[WUP API] Delete API key error:", err);
    res.status(500).json({ error: "Failed to delete API key" });
  }
};

const getMaskedKey = (key?: string) => {
  if (!key) return undefined;
  if (key.length <= 8) return "••••••••";
  return key.slice(0, 6) + "••••" + key.slice(-4);
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
      maskedKey: getMaskedKey(u.customApiKey),
      provider: u.customApiProvider,
      availableModels: u.availableModels || []
    });
  } catch (err) {
    console.error("[WUP API] Get usage error:", err);
    res.status(500).json({ error: "Failed to get usage stats" });
  }
};
