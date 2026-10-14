import { ApiError, errorMessage } from "@/lib/api";

export interface ConnectionErrorInfo {
  /** Short headline. */
  title: string;
  /** The server's message (or ours). */
  message: string;
  /** What to try next. */
  hint?: string;
  code?: string;
}

const has = (s: string, ...needles: string[]) => needles.some((n) => s.includes(n));

/** Maps a failed test/create call to a friendly message plus a hint. */
export function connectionError(e: unknown, type: "mongodb" | "sheets"): ConnectionErrorInfo {
  const code = e instanceof ApiError ? String(e.code) : undefined;
  const raw = errorMessage(e, "The connection test failed.");
  const lower = raw.toLowerCase();

  if (code === "BRIDGE_BLOCKED_HOST") {
    return {
      code,
      title: "That address can't be reached from wuup",
      message: "For your safety, wuup only connects to public database hosts. Local, private network and internal addresses are blocked.",
      hint: "Use your cluster's public hostname, for example a MongoDB Atlas mongodb+srv:// address.",
    };
  }

  if (type === "sheets") {
    if (code === "SHEETS_NOT_SHARED" || has(lower, "not shared", "permission", "403")) {
      return {
        code: code ?? "SHEETS_NOT_SHARED",
        title: "wuup can't open this sheet yet",
        message: "The sheet hasn't been shared with the wuup service account.",
        hint: "In Google Sheets, click Share, paste the service account address above, choose Viewer and send. Then try again.",
      };
    }
    if (code === "SHEETS_NOT_CONFIGURED") {
      return { code, title: "Google Sheets isn't set up on this server", message: raw };
    }
    if (code === "NOT_FOUND" || has(lower, "not found", "404")) {
      return {
        code,
        title: "We couldn't find that spreadsheet",
        message: raw,
        hint: "Copy the URL straight from your browser's address bar while the sheet is open.",
      };
    }
  }

  if (type === "mongodb") {
    if (has(lower, "authentication failed", "bad auth", "auth failed", "unauthorized", "not authorized")) {
      return {
        code,
        title: "The username or password was rejected",
        message: raw,
        hint: "Check the user and password in the connection string. Special characters in the password must be URL-encoded (for example @ becomes %40).",
      };
    }
    if (has(lower, "enotfound", "querysrv", "getaddrinfo", "dns", "eai_again")) {
      return {
        code,
        title: "We couldn't find that host",
        message: raw,
        hint: "Check the cluster address for typos. Atlas addresses look like cluster0.abcde.mongodb.net.",
      };
    }
    if (
      code === "BRIDGE_UNREACHABLE" ||
      has(lower, "timed out", "timeout", "econnrefused", "server selection", "network", "unreachable")
    ) {
      return {
        code,
        title: "Your database didn't answer",
        message: raw,
        hint: "If you use MongoDB Atlas, add wuup to Network Access (or allow access from anywhere while you test), then try again.",
      };
    }
    if (code === "VALIDATION_FAILED" || has(lower, "invalid scheme", "must begin with", "invalid connection string")) {
      return {
        code,
        title: "That doesn't look like a MongoDB connection string",
        message: raw,
        hint: "It should start with mongodb:// or mongodb+srv://",
      };
    }
  }

  if (e instanceof ApiError && e.status === 0) {
    return { code, title: "Can't reach wuup", message: raw, hint: "Check your internet connection and try again." };
  }

  return { code, title: "Something went wrong", message: raw };
}
