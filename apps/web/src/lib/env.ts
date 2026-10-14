const DEFAULT_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** localStorage key that overrides the API URL in development only (used by e2e tests). */
export const DEV_API_OVERRIDE_KEY = "wuup_dev_api_url";

function resolveApiUrl(): string {
  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
    try {
      const override = window.localStorage.getItem(DEV_API_OVERRIDE_KEY);
      if (override && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(override)) return override;
    } catch {
      /* storage blocked */
    }
  }
  return DEFAULT_API_URL;
}

/**
 * Base URL of the wuup API. Every app request goes through `api()` in `@/lib/api`.
 * In development a `wuup_dev_api_url` localStorage value (localhost only) wins,
 * so Playwright can point a shared dev server at the mock API.
 */
export const API_URL = resolveApiUrl().replace(/\/+$/, "");
