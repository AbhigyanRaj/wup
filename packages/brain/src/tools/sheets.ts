import { google } from "googleapis";
import { cryptoService } from "../utils/crypto";
import { Connection } from "@wup/models";
import type { ToolContext } from "./types";

/**
 * Reads data from a bridged Google Sheet.
 */
export const read_sheets = async ({ connectionId, sheetName, range = "A1:Z100" }: {
  connectionId: string,
  sheetName?: string,
  range?: string
}, ctx: ToolContext) => {
  console.log(`[WUP Brain Tool] Reading Google Sheet for connection ${connectionId}`);

  try {
    const conn = await loadSheetsConnection(connectionId, ctx);

    // Decrypting the Sheet URL or ID
    const sheetConfig = cryptoService.decrypt(conn.config);
    
    // Extraction of Spreadsheet ID from URL if necessary
    const spreadsheetIdMatch = sheetConfig.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    const spreadsheetId = spreadsheetIdMatch ? spreadsheetIdMatch[1] : sheetConfig;

    // Initialize Auth
    let auth: any;
    const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH;
    const apiKey = process.env.GEMINI_API_KEY;

    try {
      if (keyPath) {
        auth = new google.auth.GoogleAuth({
          keyFile: keyPath,
          scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
      }
    } catch (e) {
      console.warn("[WUP Sheets] Failed to load keyFile, falling back to API Key.");
    }

    const sheets = google.sheets({ 
      version: 'v4', 
      auth: auth || undefined 
    });
    
    const readRange = sheetName ? `${sheetName}!${range}` : range;

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: readRange,
      ...(auth ? {} : { key: apiKey })
    });

    const rows = res.data.values;
    
    return {
      success: true,
      rows: rows || [],
      count: rows ? rows.length : 0
    };
  } catch (err: any) {
    console.error("[WUP Brain Tool] Sheets EXECUTION ERROR:", err);
    return {
      success: false,
      error: err.message
    };
  }
};

/**
 * Lists the available sheets (tabs) in a Google Spreadsheet.
 */
export const get_sheets_metadata = async ({ connectionId }: { connectionId: string }, ctx: ToolContext) => {
  console.log(`[WUP Brain Tool] Getting Spreadsheet metadata for connection ${connectionId}`);

  try {
    const conn = await loadSheetsConnection(connectionId, ctx);

    const sheetConfig = cryptoService.decrypt(conn.config);
    const spreadsheetIdMatch = sheetConfig.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    const spreadsheetId = spreadsheetIdMatch ? spreadsheetIdMatch[1] : sheetConfig;

    // Initialize Auth
    let auth: any;
    const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH;
    const apiKey = process.env.GEMINI_API_KEY;

    try {
      if (keyPath) {
        auth = new google.auth.GoogleAuth({
          keyFile: keyPath,
          scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
      }
    } catch (e) {
      console.warn("[WUP Sheets Meta] Failed to load keyFile, falling back to API Key.");
    }

    const sheets = google.sheets({ 
      version: 'v4', 
      auth: auth || undefined 
    });
    
    const res = await sheets.spreadsheets.get({
      spreadsheetId,
      includeGridData: false,
      ...(auth ? {} : { key: apiKey })
    });

    const sheetsInfo = res.data.sheets?.map(s => s.properties?.title) || [];
    
    return {
      success: true,
      title: res.data.properties?.title,
      sheets: sheetsInfo
    };
  } catch (err: any) {
    console.error("[WUP Brain Tool] Sheets Meta EXECUTION ERROR:", err);
    return {
      success: false,
      error: err.message
    };
  }
};

/** Loads a Sheets bridge owned by the current user and enabled for this chat. */
async function loadSheetsConnection(connectionId: string, ctx: ToolContext) {
  if (ctx.allowedConnectionIds?.length && !ctx.allowedConnectionIds.includes(String(connectionId))) {
    throw new Error("That bridge isn't enabled for this chat.");
  }
  const conn = await Connection.findOne({ _id: connectionId, userId: ctx.userId }).catch(() => null);
  if (!conn) throw new Error("Connection not found");
  return conn;
}
