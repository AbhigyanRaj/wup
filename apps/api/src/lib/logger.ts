/**
 * Process-wide pino logger. Use `req.log` inside request handlers (it carries
 * the request id); use `logger` (or `logger.child({ mod: "x" })`) elsewhere.
 */
import pino from "pino";
import { env } from "../config/env";

const usePretty = !env.IS_PRODUCTION && !env.IS_TEST && process.stdout.isTTY === true;

export const logger = pino({
  level: env.IS_TEST && !process.env.LOG_LEVEL ? "silent" : env.LOG_LEVEL,
  base: { svc: "wuup-api" },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      'res.headers["set-cookie"]',
      "*.password",
      "*.apiKey",
      "*.token",
    ],
    censor: "[redacted]",
  },
  ...(usePretty
    ? { transport: { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss.l", ignore: "pid,hostname,svc" } } }
    : {}),
});

export type Logger = pino.Logger;
