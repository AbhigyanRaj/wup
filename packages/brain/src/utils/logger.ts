/**
 * Pluggable logger for @wup/brain. Defaults to the console; the API injects its
 * pino logger at startup with setBrainLogger(logger.child({ mod: "brain" })).
 *
 *   brainLog.warn("schema scan failed", { connectionId, err });
 *
 * Never log secrets, connection strings or API keys.
 */

/** Pino-compatible sink: (meta, message). */
export interface BrainLoggerSink {
  debug(meta: object, msg: string): void;
  info(meta: object, msg: string): void;
  warn(meta: object, msg: string): void;
  error(meta: object, msg: string): void;
}

const consoleSink: BrainLoggerSink = {
  debug: (meta, msg) => console.debug(`[brain] ${msg}`, ...metaArgs(meta)),
  info: (meta, msg) => console.info(`[brain] ${msg}`, ...metaArgs(meta)),
  warn: (meta, msg) => console.warn(`[brain] ${msg}`, ...metaArgs(meta)),
  error: (meta, msg) => console.error(`[brain] ${msg}`, ...metaArgs(meta)),
};

function metaArgs(meta: object): unknown[] {
  return meta && Object.keys(meta).length ? [meta] : [];
}

let sink: BrainLoggerSink = consoleSink;

/** Routes brain logs to `l` (e.g. a pino logger). Pass null to restore the console. */
export function setBrainLogger(l: BrainLoggerSink | null): void {
  sink = l ?? consoleSink;
}

function normalize(meta: unknown): object {
  if (meta instanceof Error) return { err: meta };
  if (meta && typeof meta === "object") return meta as object;
  if (meta === undefined) return {};
  return { detail: meta };
}

export const brainLog = {
  debug: (msg: string, meta?: unknown) => sink.debug(normalize(meta), msg),
  info: (msg: string, meta?: unknown) => sink.info(normalize(meta), msg),
  warn: (msg: string, meta?: unknown) => sink.warn(normalize(meta), msg),
  error: (msg: string, meta?: unknown) => sink.error(normalize(meta), msg),
};
