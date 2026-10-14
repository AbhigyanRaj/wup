/**
 * ObjectId helpers for route params.
 *
 *   const router = Router();
 *   objectIdParam(router, "chatId", "messageId");
 *   router.get("/:chatId", ...)   // 400 VALIDATION_FAILED "Invalid id" for a bad :chatId
 */
import type { Router } from "express";
import { HttpError } from "./httpError";

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

export function isObjectIdString(value: unknown): value is string {
  return typeof value === "string" && OBJECT_ID_RE.test(value);
}

/** Registers router.param guards that reject non-ObjectId values with 400. */
export function objectIdParam(router: Router, ...names: string[]): Router {
  for (const name of names) {
    router.param(name, (_req, _res, next, value) => {
      if (isObjectIdString(value)) return next();
      next(new HttpError(400, "VALIDATION_FAILED", "Invalid id", [{ path: `params.${name}`, message: "Invalid id" }]));
    });
  }
  return router;
}
