import { Connection } from "../../../apps/api/src/models/Connection";
import { getGeminiModel, WUP_SYSTEM_PROMPT } from "./ai/gemini";
import { WUP_AI_TOOLS, WUP_TOOLS_REGISTRY } from "./tools/registry";

/**
 * The BrainOrchestrator coordinates between user prompts, 
 * connected databases, and the Gemini AI model.
 */

export interface BrainResponse {
  content: string;
  source?: string;
  queryPerformed?: string;
}

export class BrainOrchestrator {
  /**
   * Main entry point for a user's question to the Brain.
   * Handles the Function Calling loop (Tools) internally.
   */
  async ask(userId: string, prompt: string): Promise<BrainResponse> {
    console.log(`[WUP Brain] Processing query for user ${userId}: "${prompt}"`);

    // 1. Fetch available connections for this user to provide "Context" to the AI
    const connections = await Connection.find({ userId });
    
    // 2. Prepare Tool/Bridge description for the AI System Instruction
    const bridgeInfo = connections.map(c => 
      `- Bridge: ${c.name} | Type: ${c.type} | connectionId: ${c._id}`
    ).join("\n");
    
    const dynamicInstruction = `${WUP_SYSTEM_PROMPT}\n\nACTIVE BRIDGES FOR THIS USER:\n${connections.length > 0 ? bridgeInfo : "NONE. Remind user to add a DB."}`;

    try {
      // 3. Initialize Gemini with Tools
      const model = getGeminiModel(dynamicInstruction, WUP_AI_TOOLS);
      
      // 4. Start Chat Session
      const chat = model.startChat();
      let result = await chat.sendMessage(prompt);
      let response = result.response;

      // 5. Handle Function Calling Loop (allow multiple turns)
      let calls = response.functionCalls();
      let turns = 0;
      const MAX_TURNS = 5;

      while (calls && calls.length > 0 && turns < MAX_TURNS) {
        turns++;
        const toolResponses = [];

        for (const call of calls) {
          const toolName = call.name;
          const args = call.args;

          console.log(`[WUP Brain] Turn ${turns} | Tool execution: ${toolName}`, args);

          const toolFn = WUP_TOOLS_REGISTRY[toolName];
          if (toolFn) {
            const toolResult = await toolFn(args);
            toolResponses.push({
              functionResponse: {
                name: toolName,
                response: toolResult
              }
            });
          }
        }

        if (toolResponses.length > 0) {
          result = await chat.sendMessage(toolResponses);
          response = result.response;
          calls = response.functionCalls();
        } else {
          break;
        }
      }

      return {
        content: response.text(),
        source: connections.length > 0 ? connections[0].name : undefined,
        queryPerformed: call && call.length > 0 ? call[0].name : undefined
      };
    } catch (err: any) {
      console.error("[WUP Brain] Multi-Step AI Generation ERROR:", err);
      return {
        content: "I encountered an error while trying to query your data bridges. Please ensure your credentials are still valid.",
      };
    }
  }
}

export const brain = new BrainOrchestrator();
