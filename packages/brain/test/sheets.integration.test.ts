/**
 * Google Sheets bridge with an injected fake googleapis client and a real
 * mongod (mongodb-memory-server) for the Connection model.
 */
import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Connection } from "@wup/models";
import { cryptoService } from "../src/utils/crypto";
import {
  BridgeError,
  buildBridgeDigest,
  getServiceAccountEmail,
  normaliseRange,
  parseSpreadsheetId,
  resetSheetsAuthCache,
  rowsToObjects,
  setSheetsClientFactory,
  testSheets,
  type SheetsApi,
} from "../src/bridges";
import { read_sheets, get_sheets_metadata } from "../src/tools/sheets";
import type { QueryRecord, ToolContext } from "../src/tools/types";

const SHEET_ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=0`;

let server: MongoMemoryServer;
const owner = new ObjectId().toHexString();
let sheetsConnId: string;
let mongoConnId: string;

interface Call {
  method: string;
  params: any;
}
let calls: Call[] = [];
let failWith: number | undefined;

const TABS: Record<string, any[][]> = {
  "Q1 Sales": [
    ["Region", "Rep", "Amount", ""],
    ["North", "Ada", "1200", "x"],
    ["South", "Bob", "800.5", "y"],
  ],
  "Bob's tab": [["Name"], ["one"]],
};

function googleError(status: number) {
  return Object.assign(new Error(`Request failed with status ${status}?key=AIzaSECRETKEY123`), {
    response: { status },
    code: status,
  });
}

const fakeApi: SheetsApi = {
  spreadsheets: {
    async get(params) {
      calls.push({ method: "get", params });
      if (failWith) throw googleError(failWith);
      return {
        data: {
          properties: { title: "Sales 2026" },
          sheets: Object.entries(TABS).map(([title, rows]) => ({
            properties: { title, gridProperties: { rowCount: rows.length, columnCount: rows[0].length } },
          })),
        },
      };
    },
    values: {
      async get(params) {
        calls.push({ method: "values.get", params });
        if (failWith) throw googleError(failWith);
        const m = params.range.match(/^'((?:[^']|'')+)'!(.*)$/);
        const tab = m ? m[1].replace(/''/g, "'") : "";
        return { data: { range: params.range, values: TABS[tab] ?? [] } };
      },
      async batchGet(params) {
        calls.push({ method: "values.batchGet", params });
        if (failWith) throw googleError(failWith);
        return {
          data: {
            valueRanges: params.ranges.map((r: string) => {
              const tab = r.slice(1, r.lastIndexOf("'!")).replace(/''/g, "'");
              return { range: r, values: [TABS[tab]?.[0] ?? []] };
            }),
          },
        };
      },
    },
  },
};

before(async () => {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri(), { dbName: "wup_app_sheets" });
  const sheets: any = await Connection.create({
    userId: owner,
    name: "Sales sheet",
    type: "sheets",
    config: cryptoService.encrypt(SHEET_URL),
    sheetsCache: { title: "Sales 2026", tabs: [{ name: "Q1 Sales", rows: 3, cols: 4, headers: ["Region", "Rep", "Amount"] }] },
  });
  sheetsConnId = String(sheets._id);
  const mongo: any = await Connection.create({
    userId: owner,
    name: "A mongo bridge",
    type: "mongodb",
    config: cryptoService.encrypt("mongodb://user:pw@db.example.com/x"),
  });
  mongoConnId = String(mongo._id);
  setSheetsClientFactory(() => fakeApi);
});

after(async () => {
  setSheetsClientFactory(null);
  await mongoose.disconnect();
  await server?.stop();
});

beforeEach(() => {
  calls = [];
  failWith = undefined;
});

function ctx() {
  const queries: QueryRecord[] = [];
  const rows: any[][] = [];
  const sources: any[] = [];
  const c: ToolContext = {
    userId: owner,
    onQuery: (q, r) => {
      queries.push(q);
      if (r) rows.push(r);
    },
    registerSource: (s) => {
      sources.push(s);
      return sources.length;
    },
  };
  return { c, queries, rows, sources };
}

describe("parsing helpers", () => {
  test("parseSpreadsheetId accepts URLs, ids and stored JSON configs", () => {
    assert.equal(parseSpreadsheetId(SHEET_URL), SHEET_ID);
    assert.equal(parseSpreadsheetId(SHEET_ID), SHEET_ID);
    assert.equal(parseSpreadsheetId(JSON.stringify({ url: SHEET_URL })), SHEET_ID);
    assert.equal(parseSpreadsheetId("https://example.com/not-a-sheet"), null);
    assert.equal(parseSpreadsheetId("mongodb://a:b@c"), null);
    assert.equal(parseSpreadsheetId(42), null);
  });

  test("normaliseRange validates and clamps to 500 data rows", () => {
    assert.equal(normaliseRange("A1:G50").range, "A1:G50");
    assert.equal(normaliseRange("a:d").range, "A1:D501");
    assert.equal(normaliseRange("A1:Z100000").range, "A1:Z501");
    assert.equal(normaliseRange(undefined).range, "A1:Z100");
    for (const bad of ["Sheet1!A1:B2", "A1:B2;C3", "1:1", "AAAA1", "=HYPERLINK()"]) {
      assert.throws(() => normaliseRange(bad), BridgeError, bad);
    }
  });

  test("rowsToObjects names blank and duplicate headers", () => {
    const out = rowsToObjects(["Name", "", "Name"], [["a", "1", "b"]]);
    assert.deepEqual(out.headers, ["Name", "Column B", "Name_2"]);
    assert.deepEqual(out.rows, [{ Name: "a", "Column B": 1, Name_2: "b" }]);
  });
});

describe("testSheets", () => {
  test("returns title, tabs, sizes and row-1 headers", async () => {
    const res = await testSheets(SHEET_URL);
    assert.deepEqual(res, {
      ok: true,
      type: "sheets",
      spreadsheetId: SHEET_ID,
      title: "Sales 2026",
      tabs: [
        { name: "Q1 Sales", rows: 3, cols: 4, headers: ["Region", "Rep", "Amount", ""] },
        { name: "Bob's tab", rows: 2, cols: 1, headers: ["Name"] },
      ],
    });
    const meta = calls.find((c) => c.method === "get")!;
    assert.equal(meta.params.fields, "properties.title,sheets.properties(title,gridProperties)");
    const batch = calls.find((c) => c.method === "values.batchGet")!;
    assert.deepEqual(batch.params.ranges, ["'Q1 Sales'!1:1", "'Bob''s tab'!1:1"]);
  });

  test("a 403 becomes SHEETS_NOT_SHARED naming the service account", async () => {
    const prev = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = Buffer.from(
      JSON.stringify({ client_email: "wuup-reader@proj.iam.gserviceaccount.com", private_key: "-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----\n" })
    ).toString("base64");
    resetSheetsAuthCache();
    try {
      assert.equal(getServiceAccountEmail(), "wuup-reader@proj.iam.gserviceaccount.com");
      failWith = 403;
      await assert.rejects(testSheets(SHEET_URL), (e: any) => {
        assert.ok(e instanceof BridgeError);
        assert.equal(e.code, "SHEETS_NOT_SHARED");
        assert.equal(e.message, "Share the sheet with wuup-reader@proj.iam.gserviceaccount.com as a Viewer");
        return true;
      });
    } finally {
      if (prev === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
      else process.env.GOOGLE_SERVICE_ACCOUNT_JSON = prev;
      resetSheetsAuthCache();
    }
  });

  test("a 404 becomes NOT_FOUND and errors never carry the API key", async () => {
    failWith = 404;
    await assert.rejects(testSheets(SHEET_URL), (e: any) => e instanceof BridgeError && e.code === "NOT_FOUND" && e.status === 404);
    failWith = 500;
    await assert.rejects(testSheets(SHEET_URL), (e: any) => e instanceof BridgeError && !/AIzaSECRETKEY123/.test(e.message));
  });

  test("non-Sheets input is a validation error and never calls Google", async () => {
    await assert.rejects(testSheets("mongodb://a:b@c/d"), (e: any) => e instanceof BridgeError && e.code === "VALIDATION_FAILED");
    assert.equal(calls.length, 0);
  });
});

describe("read_sheets", () => {
  test("quotes the tab, turns the header row into objects, and records the query", async () => {
    const { c, queries, rows, sources } = ctx();
    const res: any = await read_sheets({ connectionId: sheetsConnId, sheetName: "Q1 Sales", range: "A1:D3" }, c);
    assert.equal(res.success, true, res.error);
    assert.equal(calls[0].params.range, "'Q1 Sales'!A1:D3");
    assert.deepEqual(res.headers, ["Region", "Rep", "Amount", "Column D"]);
    assert.deepEqual(res.rows[0], { Region: "North", Rep: "Ada", Amount: 1200, "Column D": "x" });
    assert.equal(res.count, 2);
    assert.equal(res.citation, 1);

    assert.equal(queries.length, 1);
    assert.deepEqual(
      { ...queries[0], durationMs: 0 },
      {
        tool: "sheets_read",
        connectionName: "Sales sheet",
        db: "Sales 2026",
        collection: "Q1 Sales",
        query: "A1:D3",
        rowCount: 2,
        truncated: false,
        durationMs: 0,
      }
    );
    assert.deepEqual(rows[0], res.rows);
    assert.deepEqual(sources[0], {
      kind: "data",
      title: "Sales sheet: Sales 2026.Q1 Sales",
      connectionName: "Sales sheet",
      db: "Sales 2026",
      collection: "Q1 Sales",
      queryIndex: 0,
    });
  });

  test("tab names with quotes are escaped", async () => {
    const { c } = ctx();
    const res: any = await read_sheets({ connectionId: sheetsConnId, sheetName: "Bob's tab", range: "A:A" }, c);
    assert.equal(res.success, true, res.error);
    assert.equal(calls[0].params.range, "'Bob''s tab'!A1:A501");
    assert.deepEqual(res.rows, [{ Name: "one" }]);
  });

  test("invalid ranges are refused before calling Google", async () => {
    const { c } = ctx();
    const res: any = await read_sheets({ connectionId: sheetsConnId, sheetName: "Q1 Sales", range: "Other!A1:B2" }, c);
    assert.equal(res.success, false);
    assert.match(res.error, /A1 range/);
    assert.equal(calls.length, 0);
  });

  test("a 403 while reading is a clear tool error with an error QueryRecord", async () => {
    const { c, queries, sources } = ctx();
    failWith = 403;
    const res: any = await read_sheets({ connectionId: sheetsConnId, sheetName: "Q1 Sales" }, c);
    assert.equal(res.success, false);
    assert.match(res.error, /Share the sheet/);
    assert.equal(queries[0].error, res.error);
    assert.equal(sources.length, 0, "failed queries are not cited");
  });

  test("only sheets bridges are read (type check)", async () => {
    const { c } = ctx();
    for (const fn of [read_sheets, get_sheets_metadata] as const) {
      const res: any = await fn({ connectionId: mongoConnId } as any, c);
      assert.deepEqual(res, { success: false, error: "Connection not found" });
    }
    assert.equal(calls.length, 0, "a Mongo URI is never sent to Google");
  });

  test("another user's sheet is not found", async () => {
    const res: any = await read_sheets({ connectionId: sheetsConnId, sheetName: "Q1 Sales" }, { userId: new ObjectId().toHexString() });
    assert.deepEqual(res, { success: false, error: "Connection not found" });
  });
});

describe("get_sheets_metadata and digest", () => {
  test("returns tabs and refreshes the cache", async () => {
    const res: any = await get_sheets_metadata({ connectionId: sheetsConnId }, ctx().c);
    assert.equal(res.success, true, res.error);
    assert.deepEqual(res.sheets, ["Q1 Sales", "Bob's tab"]);
    const conn: any = await Connection.findById(sheetsConnId).lean();
    assert.equal(conn.sheetsCache.tabs.length, 2);
  });

  test("the bridge digest lists tabs and headers", () => {
    const d = buildBridgeDigest([
      {
        _id: sheetsConnId,
        name: "Sales sheet",
        type: "sheets",
        sheetsCache: { title: "Sales 2026", tabs: [{ name: "Q1 Sales", rows: 3, cols: 4, headers: ["Region", "Rep", ""] }] },
      },
    ]);
    assert.match(d, /Type: sheets/);
    assert.match(d, /Spreadsheet: Sales 2026/);
    assert.match(d, /tab "Q1 Sales" \(3 rows x 4 cols\): Region, Rep$/m);
  });
});
