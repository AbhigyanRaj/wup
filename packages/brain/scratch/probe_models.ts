import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, "../../../apps/api/.env") });

async function listModels() {
  const key = process.env.GEMINI_API_KEY || "";
  if (!key) {
    console.error("GEMINI_API_KEY missing");
    return;
  }
  const genAI = new GoogleGenerativeAI(key);
  try {
    // There is no direct listModels in the high level SDK 0.21.0 sometimes, 
    // but we can try to use the client directly or just probe.
    const models = [
      "gemini-2.0-flash", 
      "gemini-1.5-flash-latest", 
      "gemini-1.5-pro-latest", 
      "gemini-1.5-flash-8b-latest",
      "gemini-1.5-flash",
      "gemini-1.5-pro"
    ];
    for (const m of models) {
      try {
        const model = genAI.getGenerativeModel({ model: m });
        await model.generateContent("test");
        console.log(`Model ${m} is AVAILABLE`);
      } catch (e: any) {
        console.log(`Model ${m} is NOT available: ${e.message}`);
      }
    }
  } catch (err) {
    console.error(err);
  }
}

listModels();
