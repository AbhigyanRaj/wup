/**
 * Scripted stand-in for the brain orchestrator.
 *
 *   const brain = createFakeBrain([
 *     { status: "Reading your data" },
 *     { token: "Hello " }, { delayMs: 20 }, { token: "world" },
 *     { done: { content: "Hello world", followUps: [] } },
 *   ]);
 *   const app = createTestApp({ brain });
 *   ...
 *   assert.equal(brain.calls[0].prompt, "hi");
 *
 * askStream(userId, prompt, options) follows the current brain protocol:
 *   - yields text tokens as strings
 *   - yields { type: "done", data } last
 *   - status steps call options.onStatus(message, code) when given, otherwise
 *     yield { type: "status", message, code }
 * Steps: { status, code? } | { token } | { delayMs } | { done } | { error } | { yield }
 * The script may be a function of the call, to vary replies per prompt.
 *
 * Abort-aware: when options.signal aborts (also during a delay) the generator
 * throws an AbortError and `brain.aborted` is incremented.
 */
export type FakeStep =
  | { status: string; code?: string }
  | { token: string }
  | { delayMs: number }
  | { done: Record<string, unknown> }
  | { error: Error | string }
  | { yield: unknown };

export interface FakeBrainCall {
  userId: string;
  prompt: string;
  options: any;
}

export type FakeScript = FakeStep[] | ((call: FakeBrainCall) => FakeStep[]);

export const DEFAULT_SCRIPT: FakeStep[] = [
  { status: "Thinking", code: "llm.generating" },
  { token: "Hello " },
  { token: "world" },
  { done: { content: "Hello world", followUps: [], usedModel: "fake-model", exhausted: [] } },
];

function abortError(): Error {
  const err = new Error("The operation was aborted");
  err.name = "AbortError";
  return err;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(abortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export interface FakeBrain {
  calls: FakeBrainCall[];
  aborted: number;
  completed: number;
  setScript(script: FakeScript): void;
  askStream(userId: string, prompt: string, options?: any): AsyncGenerator<unknown>;
  ask(userId: string, prompt: string, options?: any): Promise<any>;
  [extra: string]: any;
}

export function createFakeBrain(script: FakeScript = DEFAULT_SCRIPT, extra: Record<string, unknown> = {}): FakeBrain {
  let current: FakeScript = script;

  const brain: FakeBrain = {
    calls: [],
    aborted: 0,
    completed: 0,

    setScript(s: FakeScript) {
      current = s;
    },

    async *askStream(userId: string, prompt: string, options: any = {}) {
      const call = { userId: String(userId), prompt, options };
      brain.calls.push(call);
      const steps = typeof current === "function" ? current(call) : current;
      const signal: AbortSignal | undefined = options?.signal;
      try {
        for (const step of steps) {
          if (signal?.aborted) throw abortError();
          if ("delayMs" in step) await sleep(step.delayMs, signal);
          else if ("status" in step) {
            if (typeof options?.onStatus === "function") options.onStatus(step.status, step.code);
            else yield { type: "status", message: step.status, code: step.code };
          } else if ("token" in step) yield step.token;
          else if ("done" in step) yield { type: "done", data: step.done };
          else if ("error" in step) throw typeof step.error === "string" ? new Error(step.error) : step.error;
          else if ("yield" in step) yield step.yield;
        }
        brain.completed++;
      } catch (err: any) {
        if (err?.name === "AbortError") brain.aborted++;
        throw err;
      }
    },

    async ask(userId: string, prompt: string, options: any = {}) {
      let content = "";
      let data: any = null;
      for await (const chunk of brain.askStream(userId, prompt, options)) {
        if (typeof chunk === "string") content += chunk;
        else if (chunk && typeof chunk === "object" && (chunk as any).type === "done") data = (chunk as any).data;
      }
      return { content, ...(data ?? {}) };
    },

    ...extra,
  };
  return brain;
}
