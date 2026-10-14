/**
 * Wraps an async Express handler so a rejected promise reaches the error
 * middleware instead of becoming an unhandled rejection:
 *
 *   router.get("/", asyncHandler(async (req, res) => { ... }));
 */
import type { NextFunction, Request, RequestHandler, Response } from "express";

export function asyncHandler<Req extends Request = Request, Res extends Response = Response>(
  fn: (req: Req, res: Res, next: NextFunction) => unknown | Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    try {
      Promise.resolve(fn(req as Req, res as Res, next)).catch(next);
    } catch (err) {
      next(err);
    }
  };
}
