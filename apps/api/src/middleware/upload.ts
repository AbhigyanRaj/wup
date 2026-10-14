import path from "path";
import multer from "multer";
import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { HttpError } from "../lib/httpError";

export const MAX_UPLOAD_SIZE_MB = env.MAX_UPLOAD_SIZE_MB;
const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

/** Lowercase extensions accepted for knowledge uploads. */
export const ALLOWED_UPLOAD_EXTENSIONS = [".pdf", ".txt", ".md", ".csv", ".docx"] as const;

export const UNSUPPORTED_FILE_MESSAGE = "Unsupported file type. Allowed: PDF, TXT, MD, CSV, DOCX.";

export function hasAllowedExtension(fileName: string): boolean {
  const ext = path.extname(fileName ?? "").toLowerCase();
  return (ALLOWED_UPLOAD_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * Multer upload middleware.
 *
 * memoryStorage(): the file never touches the filesystem (S-3, S-4). The
 * client's mimetype is ignored; the extension is checked here and the real
 * type is detected from the bytes in the controller (detectFileType).
 */
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_SIZE_BYTES, // I-4: hard file size cap
    files: 1,
    fields: 10,
  },
  fileFilter: (_req, file, cb) => {
    if (hasAllowedExtension(file.originalname)) cb(null, true);
    else cb(new HttpError(400, "UNSUPPORTED_FILE", UNSUPPORTED_FILE_MESSAGE));
  },
}).single("file"); // field name expected from the frontend form

/** Runs multer and turns its errors into HttpErrors (413 / 400). */
export const handleUpload = (req: Request, res: Response, next: NextFunction): void => {
  uploadMiddleware(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof HttpError) return next(err);
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(new HttpError(413, "PAYLOAD_TOO_LARGE", `File too large. Maximum size is ${MAX_UPLOAD_SIZE_MB}MB.`));
      }
      return next(new HttpError(400, "VALIDATION_FAILED", err.message));
    }
    return next(new HttpError(400, "VALIDATION_FAILED", "Invalid upload."));
  });
};
