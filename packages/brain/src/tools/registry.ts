import { query_mongodb, get_mongodb_schema } from "./mongodb";
import { read_sheets } from "./sheets";

/**
 * Registry of all intelligence tools available to the WUP Brain.
 * Each entry maps a Gemini Tool Name to its execution logic.
 */

export const WUP_TOOLS_REGISTRY: Record<string, Function> = {
  query_mongodb,
  get_mongodb_schema,
  read_sheets
};

/**
 * Metadata definitions for Gemini's Function Calling.
 * These tell Gemini *how* to use our tools.
 */
export const WUP_AI_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "query_mongodb",
        description: "Executes a read-only query on a bridged MongoDB collection.",
        parameters: {
          type: "OBJECT",
          properties: {
            connectionId: { type: "STRING", description: "The ID of the MongoDB connection bridge." },
            collection: { type: "STRING", description: "The name of the collection to query." },
            query: { type: "OBJECT", description: "The MongoDB query object (e.g. { category: 'sales' })." },
            limit: { type: "NUMBER", description: "Max records to return (default 10)." }
          },
          required: ["connectionId", "collection"]
        }
      },
      {
        name: "get_mongodb_schema",
        description: "Lists all collections available in a bridged MongoDB connection.",
        parameters: {
          type: "OBJECT",
          properties: {
            connectionId: { type: "STRING", description: "The ID of the MongoDB connection bridge." }
          },
          required: ["connectionId"]
        }
      },
      {
        name: "read_sheets",
        description: "Reads a range of data from a bridged Google Sheet.",
        parameters: {
          type: "OBJECT",
          properties: {
            connectionId: { type: "STRING", description: "The ID of the Google Sheets connection bridge." },
            sheetName: { type: "STRING", description: "The name of the tab/sheet." },
            range: { type: "STRING", description: "The A1 range to read (e.g. A1:G50)." }
          },
          required: ["connectionId"]
        }
      }
    ]
  }
];
