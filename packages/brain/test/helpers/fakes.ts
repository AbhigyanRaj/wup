import { LlmError, type CompleteParams, type LlmCredentials, type LlmDriver, type RunToolLoopParams, type ToolLoopResult } from "../../src/ai/driver";
import type { ContextLoader } from "../../src/orchestrator/context";
import { Brain } from "../../src/orchestrator/index";
import { ModelHealth } from "../../src/ai/modelHealth";
import type { BrainEvent, BrainRequest } from "../../src/orchestrator/types";

export type LoopScript = (p: RunToolLoopParams, call: number) => Promise<Partial<ToolLoopResult> | void>;
export type CompleteScript = (p: CompleteParams, call: number) => Promise<string>;

/** Rejects with ABORTED as soon as the signal aborts. */
export const waitForAbort = (signal: AbortSignal) =>
  new Promise<never>((_, reject) => {
    if (signal.aborted) reject(new LlmError("ABORTED", "stopped"));
    signal.addEventListener("abort", () => reject(new LlmError("ABORTED", "stopped")), { once: true });
  });

export class FakeDriver implements LlmDriver {
  readonly provider = "gemini" as const;
  readonly usingOwnKey = false;
  loops: RunToolLoopParams[] = [];
  completes: CompleteParams[] = [];

  constructor(
    public model: string,
    private readonly loop: LoopScript,
    private readonly completeScript: CompleteScript = async () => "{}"
  ) {}

  async runToolLoop(p: RunToolLoopParams): Promise<ToolLoopResult> {
    this.loops.push(p);
    let text = "";
    const wrapped = { ...p, onText: (t: string) => ((text += t), p.onText(t)) };
    const out = (await this.loop(wrapped, this.loops.length - 1)) ?? {};
    return { text, model: this.model, usage: { tokensIn: 10, tokensOut: 5 }, turns: 1, hitTurnLimit: false, ...out };
  }

  async complete(p: CompleteParams) {
    this.completes.push(p);
    return { text: await this.completeScript(p, this.completes.length - 1), usage: { tokensIn: 3, tokensOut: 2 } };
  }
}

export interface FakeContext {
  chunks?: any[];
  connections?: any[];
  knowledgeNames?: string[];
}

export function fakeLoader(ctx: FakeContext = {}): ContextLoader & { retrieves: string[] } {
  const retrieves: string[] = [];
  return {
    retrieves,
    retrieve: async (_u, q) => {
      retrieves.push(q);
      return ctx.chunks ?? [];
    },
    loadBridges: async () => ctx.connections ?? [],
    loadKnowledgeNames: async () => ctx.knowledgeNames ?? [],
  };
}

export const SERVER_LLM: LlmCredentials = { provider: "gemini", apiKey: null, keyId: "server" };

export function makeBrain(driver: FakeDriver, ctx: FakeContext = {}) {
  const loader = fakeLoader(ctx);
  const brain = new Brain({ createDriver: () => driver, contextLoader: loader, health: new ModelHealth() });
  return { brain, loader };
}

export function request(over: Partial<BrainRequest> = {}): BrainRequest {
  return {
    userId: "507f1f77bcf86cd799439011",
    prompt: "How many movies?",
    mode: "chat",
    history: [],
    llm: SERVER_LLM,
    ...over,
  };
}

export async function runCollect(brain: Brain, req: BrainRequest, signal = new AbortController().signal) {
  const events: BrainEvent[] = [];
  const result = await brain.run(req, { emit: (e) => events.push(e), signal });
  const tokens = events.filter((e): e is Extract<BrainEvent, { type: "token" }> => e.type === "token").map((e) => e.text).join("");
  return { result, events, tokens };
}

export const META = (obj: unknown) => `---WUP_META---\n${JSON.stringify(obj)}\n---END_WUP_META---`;

export const mongoBridge = {
  _id: "64b000000000000000000001",
  name: "Movies",
  type: "mongodb",
  schemaCache: {
    dbs: [{ name: "mflix", collections: [{ name: "movies", count: 21349, fields: [{ path: "title", types: ["string"] }] }] }],
  },
};

export const docChunk = (i: number, text = `Passage ${i}`) => ({
  sourceId: `64b00000000000000000000${i}`,
  sourceFile: `Report ${i}.pdf`,
  pageNumber: i,
  chunkIndex: i,
  text,
  score: 0.9,
  metadata: { sourceFile: `Report ${i}.pdf`, pageNumber: i, chunkIndex: i, sourceId: `64b00000000000000000000${i}` },
});
