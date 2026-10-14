/**
 * Final error middleware and the JSON 404. Every error response is an ApiError:
 *   { error, code, details?, requestId?, retryAfterS? }
 *
 * Mapping:
 *   HttpError                  -> its status / code / message
 *   ZodError                   -> 400 VALIDATION_FAILED (+ details)
 *   mongoose CastError         -> 400 VALIDATION_FAILED "Invalid id"
 *   body-parser parse failure  -> 400 VALIDATION_FAILED "Invalid JSON body"
 *   body too large             -> 413 PAYLOAD_TOO_LARGE
 *   multer LIMIT_FILE_SIZE     -> 413 PAYLOAD_TOO_LARGE, other multer errors -> 400
 *   anything else              -> 500 INTERNAL "Internal Server Error" (details only in logs)
 */
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import type { ApiError, ErrorCode, ErrorDetail } from "@wup/contracts";
import { env } from "../config/env";
import { HttpError } from "../lib/httpError";
import { logger } from "../lib/logger";

function requestIdOf(req: Request): string | undefined {
  const id = (req as any).id;
  return id === undefined || id === null ? undefined : String(id);
}

function send(
  req: Request,
  res: Response,
  status: number,
  code: ErrorCode,
  message: string,
  extra: { details?: ErrorDetail[]; retryAfterS?: number } = {}
) {
  const body: ApiError = { error: message, code };
  if (extra.details?.length) body.details = extra.details;
  const requestId = requestIdOf(req);
  if (requestId) body.requestId = requestId;
  if (extra.retryAfterS !== undefined) {
    body.retryAfterS = extra.retryAfterS;
    res.setHeader("Retry-After", String(Math.max(0, Math.ceil(extra.retryAfterS))));
  }
  res.status(status).json(body);
}

function zodDetails(err: ZodError): ErrorDetail[] {
  return err.issues.map((i) => ({
    path: i.path.map((p) => String(p)).join("."),
    message: i.message,
  }));
}

const CLIENT_STATUS_CODES: Record<number, ErrorCode> = {
  400: "VALIDATION_FAILED",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  415: "UNSUPPORTED_FILE",
  429: "RATE_LIMITED",
};

export function notFoundHandler(req: Request, res: Response) {
  send(req, res, 404, "NOT_FOUND", "Not found");
}

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  const log = (req as any).log ?? logger;

  if (res.headersSent) {
    // Streaming responses (SSE) cannot change status; end the stream.
    log.error({ err }, "error after headers were sent");
    if (!res.writableEnded) {
      try {
        res.end();
      } catch {
        /* ignore */
      }
    }
    return;
  }

  if (err instanceof HttpError) {
    if (err.status >= 500) log.error({ err }, "http error");
    return send(req, res, err.status, err.code, err.message, {
      details: err.details,
      retryAfterS: err.retryAfterS,
    });
  }

  if (err instanceof ZodError) {
    return send(req, res, 400, "VALIDATION_FAILED", "Validation failed", { details: zodDetails(err) });
  }

  if (err?.name === "CastError") {
    return send(req, res, 400, "VALIDATION_FAILED", "Invalid id");
  }

  if (err?.type === "entity.parse.failed" || (err instanceof SyntaxError && (err as any).status === 400)) {
    return send(req, res, 400, "VALIDATION_FAILED", "Invalid JSON body");
  }

  if (err?.type === "entity.too.large") {
    return send(req, res, 413, "PAYLOAD_TOO_LARGE", "Request body too large");
  }

  if (err?.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      return send(req, res, 413, "PAYLOAD_TOO_LARGE", `File too large. Maximum size is ${env.MAX_UPLOAD_SIZE_MB}MB.`);
    }
    return send(req, res, 400, "VALIDATION_FAILED", typeof err.message === "string" ? err.message : "Invalid upload");
  }

  // Other client errors that their producer marked safe to expose (body-parser, http-errors)
  const status = Number(err?.status ?? err?.statusCode);
  if (status >= 400 && status < 500 && err?.expose) {
    const code = CLIENT_STATUS_CODES[status] ?? "VALIDATION_FAILED";
    const message = status === 413 ? "Request body too large" : typeof err.message === "string" && err.message ? err.message : "Bad request";
    return send(req, res, status, code, message);
  }

  log.error({ err }, "unhandled error");
  send(req, res, 500, "INTERNAL", "Internal Server Error");
}
