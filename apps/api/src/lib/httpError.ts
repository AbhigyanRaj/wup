/**
 * Throw (or pass to next()) an HttpError to send a typed ApiError response:
 *
 *   throw new HttpError(404, "NOT_FOUND", "Chat not found");
 *   throw HttpError.notFound("Chat not found");
 *
 * The message is shown to the user, so keep it safe and free of internals.
 */
import type { ErrorCode, ErrorDetail } from "@wup/contracts";

export class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: ErrorDetail[];
  /** Seconds until the client may retry; also sent as the Retry-After header. */
  readonly retryAfterS?: number;
  readonly expose = true;

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    details?: ErrorDetail[],
    opts: { retryAfterS?: number } = {}
  ) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryAfterS = opts.retryAfterS;
  }

  static badRequest(message = "Bad request", details?: ErrorDetail[]) {
    return new HttpError(400, "VALIDATION_FAILED", message, details);
  }
  static unauthenticated(message = "Authentication required") {
    return new HttpError(401, "UNAUTHENTICATED", message);
  }
  static forbidden(message = "Forbidden") {
    return new HttpError(403, "FORBIDDEN", message);
  }
  static notFound(message = "Not found") {
    return new HttpError(404, "NOT_FOUND", message);
  }
  static conflict(message = "Conflict") {
    return new HttpError(409, "CONFLICT", message);
  }
  static tooMany(message = "Too many requests. Please try again later.", retryAfterS?: number) {
    return new HttpError(429, "RATE_LIMITED", message, undefined, { retryAfterS });
  }
}

export function isHttpError(err: unknown): err is HttpError {
  return err instanceof HttpError;
}
