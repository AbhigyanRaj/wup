import crypto from "crypto";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import zlib from "zlib";
import mongoose from "mongoose";
import { chunkText, cleanText } from "./chunker";
import { embedBatch } from "./embedder";

const gzip = promisify(zlib.gzip);

/**
 * Built-in knowledge templates. Asset files live in packages/ingestor/assets
 * and are resolved relative to this module, which works both from src/ (tsx)
 * and from dist/ (compiled): both directories sit next to assets/.
 */
export const TEMPLATES = {
  "demo-guide": { file: "demo-guide.md", name: "Getting started with wuup.md" },
} as const;
export type TemplateId = keyof typeof TEMPLATES;

export function templateAssetPath(id: TemplateId): string {
  return path.join(__dirname, "..", "assets", TEMPLATES[id].file);
}

interface PreparedTemplate {
  text: string;
  hash: string;
  chunks: string[];
  vectors: number[][];
}

/** Chunked and embedded once per process with the server key. */
const prepared = new Map<TemplateId, Promise<PreparedTemplate>>();

function prepare(id: TemplateId): Promise<PreparedTemplate> {
  let p = prepared.get(id);
  if (!p) {
    p = (async () => {
      const raw = await fs.promises.readFile(templateAssetPath(id), "utf8");
      const text = cleanText(raw);
      const chunks = chunkText(text);
      const vectors = await embedBatch(chunks); // server key
      const hash = crypto.createHash("sha256").update(raw).digest("hex");
      return { text, hash, chunks, vectors };
    })();
    // Do not memoise failures (e.g. a transient quota error)
    p.catch(() => prepared.delete(id));
    prepared.set(id, p);
  }
  return p;
}

/** Clears the memoised embeddings (tests). */
export function resetTemplateCache(): void {
  prepared.clear();
}

/**
 * Adds a ready-to-query copy of a template document to the user's knowledge
 * base: a KnowledgeSource with status "indexed" plus its chunks. Idempotent:
 * a user who already has the template indexed is left unchanged.
 * Returns true on success, false on any failure (never throws).
 */
export async function seedTemplateKnowledge(userId: string, templateId: TemplateId = "demo-guide"): Promise<boolean> {
  const template = TEMPLATES[templateId];
  if (!template || !mongoose.isValidObjectId(userId)) return false;
  const Source = mongoose.model("KnowledgeSource");
  const Chunk = mongoose.model("KnowledgeChunk");
  const SourceText = mongoose.model("KnowledgeSourceText");
  const uid = new mongoose.Types.ObjectId(userId);
  let sourceId: mongoose.Types.ObjectId | null = null;

  try {
    const t = await prepare(templateId);
    if (t.chunks.length === 0) return false;

    const existing: any = await Source.findOne({ userId: uid, fileHash: t.hash }).lean();
    if (existing?.status === "indexed") return true;
    if (existing) {
      await Chunk.deleteMany({ sourceId: existing._id });
      await SourceText.deleteMany({ sourceId: existing._id });
      await Source.deleteOne({ _id: existing._id });
    }

    const source: any = await Source.create({
      userId: uid,
      name: template.name,
      fileHash: t.hash,
      type: "md",
      status: "indexing",
      fileSize: Buffer.byteLength(t.text, "utf8"),
      mimeType: "text/markdown",
      attempts: 1,
      chunksTotal: t.chunks.length,
    });
    sourceId = source._id;

    await Chunk.insertMany(
      t.chunks.map((text, i) => ({
        userId: uid,
        sourceId,
        text,
        embedding: t.vectors[i],
        metadata: { pageNumber: 0, chunkIndex: i, totalChunks: t.chunks.length, sourceFile: template.name },
      }))
    );
    await SourceText.updateOne(
      { sourceId },
      { $set: { userId: uid, gz: await gzip(Buffer.from(t.text, "utf8")), chars: t.text.length } },
      { upsert: true }
    );
    await Source.updateOne(
      { _id: sourceId },
      { $set: { status: "indexed", chunkCount: t.chunks.length, chunksDone: t.chunks.length, canRetry: false } }
    );
    return true;
  } catch (err) {
    console.error(`[Ingestor] Could not seed template "${templateId}" for user ${userId}:`, err);
    if (sourceId) {
      await Chunk.deleteMany({ sourceId }).catch(() => undefined);
      await SourceText.deleteMany({ sourceId }).catch(() => undefined);
      await Source.deleteOne({ _id: sourceId }).catch(() => undefined);
    }
    return false;
  }
}
