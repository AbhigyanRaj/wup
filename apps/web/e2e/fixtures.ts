import { test as base, expect, type Page } from "@playwright/test";

export const MOCK_API = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;

export type Scenario =
  | "newUser"
  | "withData"
  | "longThread"
  | "streaming"
  | "research"
  | "clarification"
  | "streamError"
  | "freeTierExhausted"
  | "unauthorized";

type Fixtures = {
  /** Scenario for this test. Override with test.use({ scenario: "newUser" }). */
  scenario: Scenario;
  /** Set false to skip the auth cookie + token (for unauthenticated tests). */
  signedIn: boolean;
  /** Unique Bearer token for this test; the mock keeps separate state per token. */
  token: string;
};

/**
 * Signs the browser in against the mock API:
 * - `wuup_authed` marker cookie (passes src/proxy.ts)
 * - `wuup_token = scenario:<name>:<unique>` (the mock reads the scenario from it)
 * - `wuup_dev_api_url` so a shared dev server talks to the mock
 */
export const test = base.extend<Fixtures>({
  scenario: ["withData", { option: true }],
  signedIn: [true, { option: true }],
  token: async ({ scenario }, provide, testInfo) => {
    await provide(`scenario:${scenario}:${testInfo.testId}-${testInfo.retry}-${testInfo.project.name}`);
  },
  page: async ({ page, context, token, signedIn, baseURL }, provide) => {
    await context.addInitScript(
      ([api, tok, auth]) => {
        localStorage.setItem("wuup_dev_api_url", api);
        if (auth) localStorage.setItem("wuup_token", tok);
        // Skip the first-run dialog unless a test opts in (newUser scenario).
        if (!tok.startsWith("scenario:newUser")) localStorage.setItem("wuup_welcome_seen", "1");
      },
      [MOCK_API, token, signedIn] as const,
    );
    if (signedIn) {
      await context.addCookies([{ name: "wuup_authed", value: "1", url: baseURL ?? "http://localhost:3100" }]);
    }
    await provide(page);
  },
});

export { expect };

export const isMobileProject = (page: Page) => (page.viewportSize()?.width ?? 1440) < 1024;

/** Makes the sidebar visible (opens the drawer below 1024px) and returns it. */
export async function openSidebar(page: Page) {
  if (isMobileProject(page)) {
    await page.getByRole("button", { name: "Open menu" }).click();
    const drawer = page.getByRole("dialog", { name: "Menu" });
    await expect(drawer).toBeVisible();
    return drawer;
  }
  const aside = page.getByRole("complementary", { name: "Sidebar" });
  await expect(aside).toBeVisible();
  return aside;
}

/** Ends the mock session for this token so the next API call returns 401. */
export async function expireSession(token: string) {
  await fetch(`${MOCK_API}/__expire`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
}
