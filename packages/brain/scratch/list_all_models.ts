import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, "../../../apps/api/.env") });

async function listModels() {
  const key = process.env.GEMINI_API_KEY || "";
  const genAI = new GoogleGenerativeAI(key);
  try {
    // The SDK sometimes doesn't export listModels directly in some versions, 
    // but we can try fetching the models list.
    // In @google/generative-ai, listModels is not a documented top-level method in all versions.
    // However, we can use the fetch API to hit the endpoint.
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    const data = await response.json();
    console.log("AVAILABLE MODELS:");
    if (data.models) {
      data.models.forEach((m: any) => {
        console.log(`- ${m.name} | Supported: ${m.supportedGenerationMethods.join(", ")}`);
      });
    } else {
        console.log(JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error(err);
  }
}

listModels();
