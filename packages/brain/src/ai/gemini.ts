import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Lazy-initialized Gemini API client.
 */
let _genAI: GoogleGenerativeAI | null = null;

const getGenAI = () => {
  if (!_genAI) {
    const key = process.env.GEMINI_API_KEY || "";
    if (!key) {
      console.warn("[WUP Brain] WARNING: GEMINI_API_KEY is missing from environment.");
    }
    _genAI = new GoogleGenerativeAI(key);
  }
  return _genAI;
};

/**
 * MODEL SELECTION (DIAGNOSTIC MODE): 
 * Testing "gemini-1.5-flash" with v1 endpoint and minimal configuration.
 * If the issue "lies in the code" as suggested, this stripped-down call
 * will verify if standard generation is active before we re-enable 
 * complex features like Function Calling.
 */
export const GEMINI_MODEL = "gemini-1.5-flash"; 

export const getGeminiModel = (systemInstruction?: string, tools?: any[]) => {
  // Stripping tools for diagnostic verification
  const modelParams: any = {
    model: GEMINI_MODEL,
  };

  // Only trying systemInstruction
  if (systemInstruction) {
    modelParams.systemInstruction = systemInstruction;
  }

  // Explicitly using 'v1' for the first successful handshake
  return getGenAI().getGenerativeModel(modelParams, { apiVersion: 'v1' });
};

/**
 * System Prompt tuning for the WUP Brain
 */
export const WUP_SYSTEM_PROMPT = `
You are the "WUP Brain," a high-intelligence AI workspace assistant similar to Cursor or Antigravity.
Your primary goal is to provide deep insights, code analysis, and data orchestration.

CORE PERSONA:
- Minimalist, professional, and data-centric.
- You have high intelligence and can answer any general question, solve coding problems, or provide strategic advice.

DATA BRIDGE CAPABILITY:
- If you have access to "Tools," use them to read from the user's bridged databases (MongoDB, Google Sheets). Use this to provide data-backed answers.
- If the user hasn't bridged any data yet, answer their questions normally with high intelligence. 

ONE-LINE SUGGESTION POLICY:
- If no bridges are active and you are answering a general query, always append a single, subtle one-line suggestion at the very end of your response, such as:
  "_Tip: You can bridge a database via the 'Add DB' button in the sidebar to let me analyze your real-time data._"

READ-ONLY POLICY:
- You can ONLY read or explore data. You cannot modify, delete, or update any database records.

STYLE:
- Respond in a clean, concise, and futuristic manner.
- Use markdown tables for data summaries.
`;
