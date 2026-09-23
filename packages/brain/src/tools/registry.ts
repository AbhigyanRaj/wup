import { read_sheets, get_sheets_metadata } from "./sheets";
import { web_search } from "./websearch";
import { MONGO_TOOLS, MONGO_TOOL_DECLARATIONS } from "../bridges/mongo/tools";
import type { ToolFn } from "./types";

/**
 * Registry of all intelligence tools available to the WUP Brain.
 * Each entry maps a tool name to its execution logic. Every tool receives a
 * ToolContext (userId, allowed bridges, query recorder) as its second argument.
 */

export const WUP_TOOLS_REGISTRY: Record<string, ToolFn> = {
  ...MONGO_TOOLS,
  read_sheets,
  get_sheets_metadata,
  web_search
};

/**
 * Metadata definitions for Gemini's Function Calling.
 * These tell Gemini *how* to use our tools.
 */
export const WUP_AI_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "web_search",
        description: "Executes a web search to fetch current facts, news, and real-time public information from the internet.",
        parameters: {
          type: "OBJECT",
          properties: {
            query: { type: "STRING", description: "The specific search query to search on the web." }
          },
          required: ["query"]
        }
      },
      ...MONGO_TOOL_DECLARATIONS,
      {
        name: "read_sheets",
        description: "Reads a range of data from a bridged Google Sheet. Requires a sheetName (tab name).",
        parameters: {
          type: "OBJECT",
          properties: {
            connectionId: { type: "STRING", description: "The ID of the Google Sheets connection bridge." },
            sheetName: { type: "STRING", description: "The name of the tab/sheet (e.g. 'Sheet1')." },
            range: { type: "STRING", description: "The A1 range to read (e.g. A1:G50)." }
          },
          required: ["connectionId", "sheetName"]
        }
      },
      {
        name: "get_sheets_metadata",
        description: "Lists the title and all available sheet/tab names within a Google Spreadsheet connection.",
        parameters: {
          type: "OBJECT",
          properties: {
            connectionId: { type: "STRING", description: "The ID of the Google Sheets connection bridge." }
          },
          required: ["connectionId"]
        }
      }
    ]
  }
];
