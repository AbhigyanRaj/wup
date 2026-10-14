/**
 * Builds the real Express app for tests, with the test env preset and a fake
 * brain by default.
 *
 *   import { createTestApp } from "./helpers/testApp";
 *   const { app, brain } = createTestApp();               // fake brain, default script
 *   const { app } = createTestApp({ brain: myFake });
 *   const { app } = createTestApp({ mount: (a) => a.get("/boom", () => { throw new Error("x"); }) });
 *
 * Rate limiter counters are reset on every call.
 */
import { TEST_ORIGIN } from "./env";
import type express from "express";
import { createApp } from "../../src/app";
import { resetRateLimits } from "../../src/middleware/rateLimits";
import { createFakeBrain, type FakeBrain } from "./fakeBrain";

export { TEST_ORIGIN };

export function createTestApp(
  opts: { brain?: unknown; mount?: (app: express.Express) => void } = {}
): { app: express.Express; brain: FakeBrain } {
  resetRateLimits();
  const brain = (opts.brain ?? createFakeBrain()) as FakeBrain;
  const app = createApp({ brain, mount: opts.mount });
  return { app, brain };
}
