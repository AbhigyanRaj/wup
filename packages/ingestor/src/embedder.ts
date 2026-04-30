import { GoogleGenerativeAI } from "@google/generative-ai";

// Confirmed model name from your API list diagnostic
const EMBEDDING_MODEL = "gemini-embedding-2"; 
const EMBEDDING_DIMENSIONS = 768;

// Delay between individual embed() calls during batch ingestion.
const INTER_EMBED_DELAY_MS = 150;

let _genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error(
        "[Ingestor] GEMINI_API_KEY is not set. Cannot generate embeddings."
      );
    }
    _genAI = new GoogleGenerativeAI(key);
  }
  return _genAI;
}

/**
 * Generates a single embedding vector for a text string.
 */
export async function embed(text: string): Promise<number[]> {
  // Explicitly use v1beta as it is confirmed to host gemini-embedding-2
  const model = getGenAI().getGenerativeModel(
    { model: EMBEDDING_MODEL },
    { apiVersion: "v1beta" }
  );
  
  // Request 768 dimensions to match our MongoDB Atlas index
  const result = await model.embedContent({
    content: { role: "user", parts: [{ text }] },
    outputDimensionality: 768
  });
  
  const values = result.embedding.values;

  if (!values || values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `[Ingestor] Expected ${EMBEDDING_DIMENSIONS}-dim embedding, got ${values?.length ?? 0}`
    );
  }

  return values;
}

/**
 * Embeds a single text string with exponential backoff retry.
 */
export async function embedWithRetry(
  text: string,
  maxRetries = 5
): Promise<number[]> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await embed(text);
    } catch (err: unknown) {
      lastError = err;
      const errStr = JSON.stringify(err);

      if (errStr.includes("PerDay") || errStr.includes("RESOURCE_EXHAUSTED")) {
        console.error("[Ingestor] Daily embedding quota exhausted. Failing fast.");
        throw err;
      }

      const is429 =
        (err as any)?.status === 429 ||
        errStr.includes("429") ||
        errStr.includes("RATE_LIMIT");

      if (is429 && attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(
          `[Ingestor] Rate limit hit on embed attempt ${attempt + 1}/${maxRetries}. Retrying in ${delay}ms...`
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      throw err;
    }
  }

  throw lastError ?? new Error("[Ingestor] embedWithRetry exhausted all attempts");
}

/**
 * Embeds an array of texts sequentially.
 */
export async function embedBatch(
  texts: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<number[][]> {
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i++) {
    if (i > 0) {
      await new Promise((r) => setTimeout(r, INTER_EMBED_DELAY_MS));
    }
    results.push(await embedWithRetry(texts[i]));
    onProgress?.(i + 1, texts.length);
  }

  return results;
}

export { EMBEDDING_DIMENSIONS };
