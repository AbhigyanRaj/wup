import { defineConfig, devices } from "@playwright/test";

/*
 * E2E for the authenticated app.
 *
 * - The mock API (e2e/mock-api/server.mjs) runs on :4100.
 * - The web app runs on :3100. Next 16 allows one `next dev` per project, so an
 *   already-running dev server is reused (even one pointed at the real API):
 *   tests point the browser at the mock through the dev-only
 *   `wuup_dev_api_url` localStorage override (see src/lib/env.ts and
 *   e2e/fixtures.ts).
 */
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3100";
const MOCK_PORT = Number(process.env.MOCK_API_PORT ?? 4100);

export default defineConfig({
  testDir: "./e2e",
  testIgnore: ["**/mock-api/**"],
  // A shared `next dev` compiles routes on first hit and can be slow under load.
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    navigationTimeout: 90_000,
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
  ],
  webServer: [
    {
      command: `node e2e/mock-api/server.mjs`,
      url: `http://localhost:${MOCK_PORT}/health`,
      env: { PORT: String(MOCK_PORT) },
      reuseExistingServer: true,
      timeout: 15_000,
    },
    {
      command: "npx next dev -p 3100",
      url: BASE_URL,
      env: { NEXT_PUBLIC_API_URL: `http://localhost:${MOCK_PORT}` },
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
});
