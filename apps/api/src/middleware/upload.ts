import multer from "multer";
import { Request, Response, NextFunction } from "express";

const MAX_UPLOAD_SIZE_MB = parseInt(
  process.env.MAX_UPLOAD_SIZE_MB ?? "20",
  10
);
const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

// Accepted MIME types for upload
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "text/plain",
];

/**
 * Multer upload middleware.
 *
 * Uses memoryStorage() — the file NEVER touches the filesystem (S-3, S-4).
 * The raw buffer is available at req.file.buffer for the ingestor.
 */
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_SIZE_BYTES, // I-4: hard file size cap
    files: 1, // Only one file per request
  },
  fileFilter: (_req, file, cb) => {
    // I-1: Validate MIME type server-side (client-side accept is not enough)
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Unsupported file type: ${file.mimetype}. Allowed: PDF, TXT.`
        )
      );
    }
  },
}).single("file"); // Field name expected from the frontend form

/**
 * Error-handling wrapper for multer middleware.
 * Converts multer errors into clean JSON responses.
 */
export const handleUpload = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  uploadMiddleware(req, res, (err) => {
    if (!err) {
      return next();
    }

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({
          error: `File too large. Maximum size is ${MAX_UPLOAD_SIZE_MB}MB.`,
        });
        return;
      }
      res.status(400).json({ error: err.message });
      return;
    }

    // fileFilter rejection or other errors
    res.status(400).json({ error: (err as Error).message });
  });
};
