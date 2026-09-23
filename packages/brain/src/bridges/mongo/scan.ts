import { Connection } from "@wup/models";
import { cryptoService } from "../../utils/crypto";
import { getGeminiModel } from "../../ai/gemini";
import { getPooledClient, releasePooledClient } from "./clientPool";
import { buildBridgeDigest } from "./digest";
import { describeMongoError } from "./errors";
import { scanScope } from "./introspect";
import { detectSensitiveFields, redactionKey, type RedactionMap } from "./redact";

/**
 * Background job: samples every in-scope collection, stores the schema cache,
 * auto-detects sensitive fields for new collections, and generates starter
 * questions. Never throws; failures are written to metadata.lastError.
 */
export async function scanConnection(connectionId: string): Promise<void> {
  const conn: any = await Connection.findById(connectionId);
  if (!conn || conn.type !== "mongodb") return;

  await Connection.updateOne({ _id: conn._id }, { $set: { "metadata.status": "scanning" } });

  try {
    const uri = cryptoService.decrypt(conn.config);
    // Drop any pooled client so a changed URI or scope is picked up fresh
    releasePooledClient(String(conn._id));
    const client = await getPooledClient(String(conn._id), uri);
    const scope = (conn.scope ?? []).map((s: any) => ({ db: s.db, collections: s.collections ?? ["*"] }));
    const dbs = await scanScope(client, scope);

    // Keep user-edited redactions; auto-fill only collections we haven't seen before
    const redactions: RedactionMap = { ...(conn.redactedFields ?? {}) };
    for (const db of dbs) {
      for (const coll of db.collections) {
        const key = redactionKey(db.name, coll.name);
        if (!(key in redactions)) redactions[key] = detectSensitiveFields(coll.fields);
        // Never keep sample values for hidden fields in the cache
        const hidden = new Set(redactions[key]);
        for (const f of coll.fields) if (hidden.has(f.path)) delete f.sample;
      }
    }

    const schemaCache = { scannedAt: new Date(), dbs };
    const suggestions = await generateSuggestions({
      _id: conn._id,
      name: conn.name,
      type: conn.type,
      scope,
      redactedFields: redactions,
      schemaCache,
    });

    await Connection.updateOne(
      { _id: conn._id },
      {
        $set: {
          schemaCache,
          redactedFields: redactions,
          suggestions,
          "metadata.status": "active",
          "metadata.lastSynced": new Date(),
          "metadata.lastError": null,
        },
      }
    );
    const total = dbs.reduce((n, d) => n + d.collections.length, 0);
    console.log(`[WUP Bridge] Scanned connection ${conn._id}: ${dbs.length} dbs, ${total} collections`);
  } catch (err) {
    const message = describeMongoError(err);
    console.error(`[WUP Bridge] Scan failed for connection ${conn._id}: ${message}`);
    await Connection.updateOne(
      { _id: conn._id },
      { $set: { "metadata.status": "error", "metadata.lastError": message } }
    );
  }
}

const SUGGESTION_MODELS = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-flash-lite-latest"];

/** Asks the LLM for starter questions based on the schema; falls back to templates. */
async function generateSuggestions(conn: Parameters<typeof buildBridgeDigest>[0][number]): Promise<string[]> {
  const digest = buildBridgeDigest([conn]);
  const prompt =
    "Here is the schema of a user's MongoDB data:\n" +
    digest +
    "\n\nWrite 5 short, specific questions (max 12 words each) a business user would ask about this data, " +
    "mixing counts, top-N rankings, trends over time and comparisons. Use real collection and field meanings, " +
    "not field names in code style. Return ONLY a JSON array of strings.";

  if (!process.env.GEMINI_API_KEY) return templateSuggestions(conn);

  for (const model of SUGGESTION_MODELS) {
    try {
      const res = await getGeminiModel(undefined, undefined, model).generateContent(prompt);
      const match = res.response.text().match(/\[[\s\S]*\]/);
      const parsed = match ? JSON.parse(match[0]) : null;
      if (Array.isArray(parsed)) {
        const questions = parsed.filter((q) => typeof q === "string" && q.trim()).map((q: string) => q.trim());
        if (questions.length > 0) return questions.slice(0, 6);
      }
    } catch {
      // try the next model
    }
  }
  return templateSuggestions(conn);
}

/** Exported for tests: deterministic questions when no LLM is available. */
export function templateSuggestions(conn: Parameters<typeof buildBridgeDigest>[0][number]): string[] {
  const colls = (conn.schemaCache?.dbs ?? [])
    .flatMap((d) => d.collections.map((c) => ({ db: d.name, ...c })))
    .sort((a, b) => b.count - a.count);
  const out: string[] = [];
  for (const c of colls.slice(0, 3)) {
    out.push(`How many ${c.name} are there?`);
    const dateField = c.fields.find((f) => f.types.includes("date"));
    if (dateField) out.push(`How have ${c.name} grown over time by ${dateField.path}?`);
    else out.push(`Show me 10 sample ${c.name}`);
  }
  return out.slice(0, 5);
}
