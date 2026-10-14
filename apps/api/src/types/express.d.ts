/**
 * Request augmentation shared by every route.
 *   req.auth           set by authenticate / optionalAuthenticate
 *   req.user           legacy-compatible user ({ id, email, role, isDemo })
 *   req.validatedQuery parsed query from validate({ query })
 *   req.log / req.id   from pino-http (request-scoped logger and request id)
 */
import type { Logger } from "pino";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        isDemo: boolean;
        via: "cookie" | "bearer";
      };
      user?: {
        id: string;
        email: string;
        role: string;
        isDemo: boolean;
      };
      validatedQuery?: any;
      log: Logger;
    }
  }
}

export {};
