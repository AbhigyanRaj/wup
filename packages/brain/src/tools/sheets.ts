import { google } from "googleapis";
import { cryptoService } from "../utils/crypto";
import { Connection } from "../../../../apps/api/src/models/Connection";

/**
 * Reads data from a bridged Google Sheet.
 */
export const read_sheets = async ({ connectionId, sheetName, range = "A1:Z100" }: {
  connectionId: string,
  sheetName?: string,
  range?: string
}) => {
  console.log(`[WUP Brain Tool] Reading Google Sheet for connection ${connectionId}`);

  try {
    const conn = await Connection.findById(connectionId);
    if (!conn) throw new Error("Connection not found");

    // Decrypting the Sheet URL or ID
    const sheetConfig = cryptoService.decrypt(conn.config);
    
    // Extraction of Spreadsheet ID from URL if necessary
    const spreadsheetIdMatch = sheetConfig.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    const spreadsheetId = spreadsheetIdMatch ? spreadsheetIdMatch[1] : sheetConfig;

    // Initialize Auth (Using Service Account for simplicity in this phase)
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    const readRange = sheetName ? `${sheetName}!${range}` : range;

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: readRange,
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
export const get_sheets_metadata = async ({ connectionId }: { connectionId: string }) => {
  console.log(`[WUP Brain Tool] Getting Spreadsheet metadata for connection ${connectionId}`);

  try {
    const conn = await Connection.findById(connectionId);
    if (!conn) throw new Error("Connection not found");

    const sheetConfig = cryptoService.decrypt(conn.config);
    const spreadsheetIdMatch = sheetConfig.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    const spreadsheetId = spreadsheetIdMatch ? spreadsheetIdMatch[1] : sheetConfig;

    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    const res = await sheets.spreadsheets.get({
      spreadsheetId,
      includeGridData: false
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
