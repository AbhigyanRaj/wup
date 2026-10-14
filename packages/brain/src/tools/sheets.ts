/**
 * @deprecated The Google Sheets bridge lives in ../bridges/sheets. This shim
 * keeps the tool names and imports registry.ts and older code rely on.
 */
export {
  read_sheets,
  get_sheets_metadata,
  safeSheetsErrorMessage,
  SHEETS_TOOLS,
  SHEETS_BRIDGE_TOOL_DECLARATIONS,
} from "../bridges/sheets";
