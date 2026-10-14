/**
 * Express application factory. No I/O at construction: server.ts connects the
 * database, runs migrations and listens; tests call createApp() directly.
 *
 *   const app = createApp();                    // real brain
 *   const app = createApp({ brain: fakeBrain }); // tests
 *
 * The brain is exposed as `req.app.locals.brain`.
 *
 * Middleware order:
 *   pino-http (request id) -> helmet -> cors -> cookie-parser
 *   -> /public (own 24kb JSON parser)
 *   -> csrf -> express.json(1mb) -> rejectOperators -> global rate limit
 *   -> routers -> 404 -> error handler
 */
import { randomUUID } from "crypto";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { brain as realBrain, setBrainLogger } from "@wup/brain";

// Register models before any router touches them by name
import "@wup/models";

import { env, isAllowedOrigin, type Env } from "./config/env";
import { logger } from "./lib/logger";
import { csrfProtection } from "./middleware/csrf";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { globalLimiter } from "./middleware/rateLimits";
import { rejectOperators } from "./middleware/rejectOperators";
import authRoutes from "./routes/auth";
import chatRoutes from "./routes/chat";
import connectionRoutes from "./routes/connection";
import knowledgeRoutes from "./routes/knowledge";
import metaRoutes from "./routes/meta";
import publicRoutes from "./routes/public";
import systemRoutes from "./routes/system";
import userRoutes from "./routes/user";

export interface AppDeps {
  /** Brain implementation exposed as app.locals.brain. Defaults to the real one. */
  brain?: unknown;
  /** Tests: mount extra routes before the 404 handler. */
  mount?: (app: express.Express) => void;
}

const REQUEST_ID_RE = /^[A-Za-z0-9._:-]{1,128}$/;

/** Accepts a sane incoming x-request-id, otherwise generates one. */
export function resolveRequestId(header: unknown): string {
  if (typeof header === "string" && REQUEST_ID_RE.test(header)) return header;
  return randomUUID();
}

/** CORS: exact allowlist from CORS_ORIGIN, localhost only outside production. */
export function buildCors(e: Env = env) {
  return cors({
    origin(origin, cb) {
      // Non-browser clients (curl, server-to-server) send no Origin
      if (!origin) return cb(null, true);
      // Reject without an error: no CORS headers, the browser blocks the response
      cb(null, isAllowedOrigin(origin, e));
    },
    credentials: true,
    exposedHeaders: ["X-Request-Id", "RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset", "Retry-After"],
    maxAge: 600,
  });
}

export function createApp(deps: AppDeps = {}): express.Express {
  const app = express();

  app.locals.brain = deps.brain ?? realBrain;
  app.set("trust proxy", env.TRUST_PROXY);
  app.disable("x-powered-by");

  if (!deps.brain) {
    try {
      setBrainLogger(logger.child({ mod: "brain" }) as any);
    } catch {
      /* older brain builds have no logger hook */
    }
  }

  // 1. Request logging + request id
  app.use(
    pinoHttp({
      logger,
      genReqId(req, res) {
        const id = resolveRequestId(req.headers["x-request-id"]);
        res.setHeader("X-Request-Id", id);
        return id;
      },
      customLogLevel(_req, res, err) {
        if (err || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      },
      autoLogging: {
        ignore: (req) => req.url === "/health" || req.method === "OPTIONS",
      },
      serializers: {
        req(req) {
          return { id: req.id, method: req.method, url: req.url };
        },
        res(res) {
          return { statusCode: res.statusCode };
        },
      },
    })
  );

  // 2. Security headers (CORP same-site so a sibling-subdomain web app can embed responses)
  app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));

  // 3. CORS
  app.use(buildCors());

  // 4. Cookies
  app.use(cookieParser());

  // 5a. Public (marketing) routes: own small parser, no session, no operator check
  app.use("/public", express.json({ limit: "24kb" }), publicRoutes);

  // 5b. CSRF for cookie sessions (Bearer requests are exempt)
  app.use(csrfProtection);

  // 5c. JSON bodies for everything else
  app.use(express.json({ limit: "1mb" }));

  // 6. No "$" keys in bodies or query strings (except free-form routes)
  app.use(rejectOperators);

  // 7. Global per-IP rate limit
  app.use(globalLimiter);

  // 8. Routers
  app.use(systemRoutes);
  app.use(metaRoutes);
  app.use("/auth", authRoutes);
  app.use("/user", userRoutes);
  app.use("/chats", chatRoutes);
  app.use("/connections", connectionRoutes);
  app.use("/knowledge", knowledgeRoutes);

  deps.mount?.(app);

  // 9. 404
  app.use(notFoundHandler);

  // 10. Errors
  app.use(errorHandler);

  return app;
}

export default createApp;
