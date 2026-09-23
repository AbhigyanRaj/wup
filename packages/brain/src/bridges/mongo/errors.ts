/**
 * Turns raw driver errors into messages a user can act on, and makes sure
 * credentials never leak into logs, API responses, or the LLM context.
 */

/** Replaces the password in any mongodb:// or mongodb+srv:// URI inside a string. */
export function maskUri(text: string): string {
  return text.replace(/(mongodb(?:\+srv)?:\/\/[^:/@\s]+):[^@\s]+@/gi, "$1:****@");
}

export function isMongoUri(uri: string): boolean {
  return /^mongodb(\+srv)?:\/\//i.test(uri.trim());
}

/** Human-readable explanation for a connection/query failure. */
export function describeMongoError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const msg = raw.toLowerCase();

  if (msg.includes("invalid scheme") || msg.includes("expected connection string")) {
    return "That doesn't look like a MongoDB URL. It should start with mongodb:// or mongodb+srv://";
  }
  if (msg.includes("authentication failed") || msg.includes("bad auth")) {
    return "Authentication failed. Check the username and password in the URL (special characters in the password must be URL-encoded).";
  }
  if (msg.includes("querysrv") || msg.includes("enotfound") || msg.includes("getaddrinfo")) {
    return "Couldn't find that cluster host. Check the hostname in the URL.";
  }
  if (
    msg.includes("server selection") ||
    msg.includes("timed out") ||
    msg.includes("etimedout") ||
    msg.includes("econnrefused") ||
    msg.includes("whitelist")
  ) {
    return "Couldn't reach the cluster. If it's on MongoDB Atlas, open Network Access and allow this server's IP address (or 0.0.0.0/0 while testing).";
  }
  if (msg.includes("not authorized") || msg.includes("unauthorized")) {
    return "This database user doesn't have permission for that operation. Give it at least the read role on the databases you want WUUP to use.";
  }
  if (msg.includes("operation exceeded time limit") || msg.includes("maxtimems")) {
    return "The query took longer than 10 seconds and was stopped. Try a narrower filter or add an index.";
  }
  return maskUri(raw);
}
