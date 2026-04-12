import { Connection } from "../../../apps/api/src/models/Connection";
import { getGeminiModel, WUP_SYSTEM_PROMPT } from "./ai/gemini";
import { WUP_AI_TOOLS, WUP_TOOLS_REGISTRY } from "./tools/registry";

export interface BrainResponse {
  content: string;
  source?: string;
  queryPerformed?: string;
}

export class BrainOrchestrator {
  async ask(userId: string, prompt: string): Promise<BrainResponse> {
    console.log(`[WUP Brain] Processing query for user ${userId}: "${prompt}"`);

    const connections = await Connection.find({ userId });
    
    const bridgeInfo = connections.map(c => 
      `- Bridge: ${c.name} | Type: ${c.type} | ID: ${c._id}`
    ).join("\n");
    
    const dynamicInstruction = `${WUP_SYSTEM_PROMPT}\n\nACTIVE BRIDGES FOR THIS USER:\n${connections.length > 0 ? bridgeInfo : "NONE. Remind user to add a DB."}`;

    try {
      const model = getGeminiModel(dynamicInstruction, WUP_AI_TOOLS);
      const chat = model.startChat();
      let result = await chat.sendMessage(prompt);
      let response = result.response;

      // Handle multi-step function calling loop
      // Gemini may call multiple tools in sequence before giving a text response
      let callsMade: any[] = [];
      let maxIterations = 5; // prevent infinite loops
      let iterations = 0;

      while (iterations < maxIterations) {
        const calls = response.functionCalls();
        
        if (!calls || calls.length === 0) {
          // No more tool calls — Gemini is ready to give final text response
          break;
        }

        iterations++;
        const functionCall = calls[0];
        const toolName = functionCall.name;
        const args = functionCall.args;

        console.log(`[WUP Brain] Gemini is requesting tool: ${toolName}`, args);
        callsMade.push(functionCall);

        const toolFn = WUP_TOOLS_REGISTRY[toolName];
        if (!toolFn) {
          console.warn(`[WUP Brain] Tool not found: ${toolName}`);
          break;
        }

        const toolResult = await toolFn(args);
        console.log(`[WUP Brain] Tool result for ${toolName}:`, JSON.stringify(toolResult).substring(0, 200));

        // Send tool result back to Gemini
        result = await chat.sendMessage([
          {
            functionResponse: {
              name: toolName,
              response: toolResult
            }
          }
        ]);
        response = result.response;
      }

      // Guard against empty response
      const finalText = response.text();
      if (!finalText || finalText.trim() === '') {
        console.warn("[WUP Brain] Empty response from Gemini after tool calls");
        return {
          content: "I retrieved your data but had trouble formatting the response. Please try asking again with more specific details.",
          source: connections.length > 0 ? connections[0].name : undefined,
        };
      }

      return {
        content: finalText,
        source: connections.length > 0 ? connections[0].name : undefined,
        queryPerformed: callsMade.length > 0 ? callsMade.map(c => c.name).join(', ') : undefined
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