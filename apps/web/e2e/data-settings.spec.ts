import { test, expect as baseExpect, type Page } from "@playwright/test";
import { installDataMocks } from "./mock-api/data-scenarios.mjs";

/*
 * Data sources + settings (APP-4). The API is mocked in the browser with
 * page.route (e2e/mock-api/data-scenarios.mjs), so these tests need only the
 * Next dev server.
 */

// The shared dev server compiles routes on first hit and runs under load: be patient.
const expect = baseExpect.configure({ timeout: 25_000 });
test.describe.configure({ timeout: 180_000 });

type Call = { method: string; path: string; body: unknown };
type Mock = { calls: Call[]; state: Record<string, unknown> };

async function setup(page: Page, opts: Record<string, unknown> = {}): Promise<Mock> {
  return installDataMocks(page, opts) as Promise<Mock>;
}

const called = (mock: Mock, method: string, path: string | RegExp) =>
  mock.calls.filter((c) => c.method === method && (typeof path === "string" ? c.path === path : path.test(c.path)));

async function openConnect(page: Page) {
  await page.goto("/data");
  await page.getByTestId("connect-data").click();
  await expect(page.getByTestId("connect-dialog")).toBeVisible();
}

test.describe("data sources", () => {
  test("MongoDB wizard happy path", async ({ page }) => {
    const mock = await setup(page);
    await openConnect(page);
    await expect(page.getByTestId("source-postgresql")).toContainText("Coming soon");
    await expect(page.getByText("Supabase")).toHaveCount(0);

    await page.getByTestId("source-mongodb").click();
    await expect(page.getByText("Step 1 of 4")).toBeVisible();
    await page.getByTestId("mongo-url").fill("mongodb+srv://reader:pw@cluster0.abcde.mongodb.net");
    await page.getByTestId("wizard-next").click();

    await expect(page.getByText(/Connected\. Found 2 databases/)).toBeVisible();
    await expect(page.getByText("Step 2 of 4")).toBeVisible();
    // DEFAULT_EXCLUDED: sessions starts unticked
    await expect(page.getByRole("checkbox", { name: /^sessions/ })).not.toBeChecked();
    await expect(page.getByTestId("wizard-next")).toHaveText(/Continue with 5 collections/);
    await page.getByTestId("wizard-next").click();

    await expect(page.getByText("Step 3 of 4")).toBeVisible();
    await expect(page.getByRole("button", { name: /passwordHash: hidden/ })).toBeVisible();
    await page.getByRole("button", { name: /phone: hidden/ }).click(); // share phone
    await page.getByTestId("wizard-next").click();

    await expect(page.getByText("Step 4 of 4")).toBeVisible();
    await expect(page.getByTestId("bridge-name")).toHaveValue("cluster0 (MongoDB)");
    await page.getByTestId("wizard-next").click();

    await expect(page.getByTestId("wizard-ready")).toBeVisible({ timeout: 20_000 });
    const ask = page.getByRole("link", { name: "How many orders were placed last week?" });
    await expect(ask).toHaveAttribute("href", /\/chat\?q=How%20many%20orders.*&send=1/);

    const create = called(mock, "POST", "/connections")[0];
    const body = create.body as { scope: unknown; redactedFields: Record<string, string[]>; type: string };
    expect(body.type).toBe("mongodb");
    expect(body.scope).toEqual([
      { db: "shop", collections: ["customers", "order_totals", "orders", "products"] },
      { db: "analytics", collections: ["events"] },
    ]);
    expect(body.redactedFields["shop.customers"].sort()).toEqual(["email", "passwordHash"]);
  });

  test("blocked host shows a friendly message", async ({ page }) => {
    await setup(page);
    await openConnect(page);
    await page.getByTestId("source-mongodb").click();
    await page.getByTestId("mongo-url").fill("mongodb://localhost:27017/app");
    await page.getByTestId("wizard-next").click();
    await expect(page.getByRole("alert")).toContainText("can't be reached from wuup");
  });

  test("Sheets: not-shared hint and the service account", async ({ page }) => {
    await setup(page);
    await openConnect(page);
    await page.getByTestId("source-sheets").click();
    await expect(page.getByTestId("service-account")).toHaveText(/iam\.gserviceaccount\.com/);
    await expect(page.getByText("Share your sheet with this address as a Viewer")).toBeVisible();
    await page.getByTestId("sheets-url").fill("https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit");
    await page.getByTestId("wizard-next").click();
    const alert = page.getByRole("alert");
    await expect(alert).toContainText("wuup can't open this sheet yet");
    await expect(alert).toContainText("choose Viewer");
  });

  test("Sheets disabled when the server has no sheets feature", async ({ page }) => {
    await setup(page, { features: ["sample"] });
    await openConnect(page);
    await expect(page.getByTestId("source-sheets")).toContainText("Not configured");
    await expect(page.getByTestId("source-sheets")).toHaveAttribute("aria-disabled", "true");
  });

  test("Postgres waitlist", async ({ page }) => {
    const mock = await setup(page);
    await openConnect(page);
    await page.getByRole("button", { name: "Join the waitlist" }).click();
    await expect(page.getByText("You're on the list")).toBeVisible();
    expect((called(mock, "POST", "/waitlist")[0].body as { feature: string }).feature).toBe("postgresql");
  });

  test("delete a bridge asks first, then removes the row", async ({ page }) => {
    const mock = await setup(page);
    await page.goto("/data");
    const rows = page.getByTestId("bridge-row");
    await expect(rows).toHaveCount(3);

    await rows.first().getByTestId("row-menu").click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Delete Production orders?");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    expect(called(mock, "DELETE", /^\/connections\//)).toHaveLength(0);

    await rows.first().getByTestId("row-menu").click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete source" }).click();
    await expect(rows).toHaveCount(2);
    expect(called(mock, "DELETE", /^\/connections\//)).toHaveLength(1);
  });

  test("a failed delete rolls back", async ({ page }) => {
    await setup(page, { failDeletes: true });
    await page.goto("/data");
    const rows = page.getByTestId("bridge-row");
    await expect(rows).toHaveCount(3);
    await rows.first().getByTestId("row-menu").click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete source" }).click();
    await expect(page.getByText("Couldn't delete Production orders")).toBeVisible();
    await expect(rows).toHaveCount(3);
  });

  test("sample bridges are read-only in the drawer", async ({ page }) => {
    await setup(page);
    await page.goto(`/data?bridge=${"b3".padEnd(24, "0")}`);
    const drawer = page.getByTestId("bridge-drawer");
    await expect(drawer).toBeVisible();
    await expect(page.getByText("Sample data is read-only")).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh schema" })).toHaveCount(0);
  });

  test("drawer hides a field (PATCH redactedFields)", async ({ page }) => {
    const mock = await setup(page);
    await page.goto("/data");
    await page.getByTestId("bridge-row").first().click();
    await expect(page).toHaveURL(/bridge=/);
    await page.getByRole("button", { name: /shop\.orders/ }).click();
    await page.getByRole("button", { name: /^total: shared/ }).click();
    await expect.poll(() => called(mock, "PATCH", /^\/connections\//).length).toBe(1);
    const patch = called(mock, "PATCH", /^\/connections\//)[0].body as { redactedFields: Record<string, string[]> };
    expect(patch.redactedFields["shop.orders"]).toEqual(["total"]);
  });

  test("documents: retry a failed file", async ({ page }) => {
    const mock = await setup(page);
    await page.goto("/data?tab=documents");
    const failed = page.locator('[data-testid="doc-row"][data-status="error"]');
    await expect(failed).toHaveCount(1);
    await failed.getByTestId("retry-doc").click();
    await expect.poll(() => called(mock, "POST", /\/knowledge\/.+\/retry$/).length).toBe(1);
    await expect(page.locator('[data-testid="doc-row"][data-status="error"]')).toHaveCount(0);
  });

  test("uploads: indexing is never shown as failed", async ({ page }) => {
    await setup(page, { indexingNeverFinishes: true });
    await page.goto("/data?tab=documents");
    await page.getByRole("button", { name: "Upload document" }).first().click();
    await expect(page.getByTestId("upload-formats")).toHaveText("PDF, TXT, Markdown, CSV or Word, up to 20 MB");
    await page.getByTestId("file-input").setInputFiles({
      name: "notes.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Notes\n".repeat(50)),
    });
    const row = page.getByTestId("upload-row").first();
    await expect(row).toHaveAttribute("data-phase", "indexing", { timeout: 10_000 });
    await expect(row.getByTestId("indexing-label")).toHaveText(/Indexing \d+ of 40 chunks/);
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(1000);
      await expect(row).not.toHaveAttribute("data-phase", "failed");
    }
    // Closing the dialog keeps the upload in the module store.
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Upload document" }).first().click();
    await expect(page.getByTestId("upload-row").first()).toHaveAttribute("data-phase", "indexing");
  });

  test("uploads: duplicate and unsupported files", async ({ page }) => {
    await setup(page);
    await page.goto("/data?tab=documents");
    await page.getByRole("button", { name: "Upload document" }).first().click();
    await page.getByTestId("file-input").setInputFiles([
      { name: "duplicate.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") },
      { name: "slides.pptx", mimeType: "application/vnd.ms-powerpoint", buffer: Buffer.from("x") },
    ]);
    await expect(page.locator('[data-testid="upload-row"][data-phase="duplicate"]')).toContainText("Already uploaded");
    await expect(page.locator('[data-testid="upload-row"][data-phase="failed"]')).toContainText("files only");
  });

  test("empty states", async ({ page }) => {
    await setup(page, { scenario: "empty" });
    await page.goto("/data");
    await expect(page.getByTestId("sources-empty")).toContainText("Connect your first database");
    await page.getByRole("radio", { name: /Documents/ }).click();
    await expect(page).toHaveURL(/tab=documents/);
    await expect(page.getByTestId("documents-empty")).toContainText("No documents yet");
  });
});

test.describe("settings", () => {
  test("redirects /settings to profile", async ({ page }) => {
    await setup(page);
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings\/profile$/);
  });

  test("profile saves the name", async ({ page }) => {
    const mock = await setup(page);
    await page.goto("/settings/profile");
    await expect(page.getByTestId("settings-profile")).toBeVisible();
    await page.getByTestId("profile-name").fill("Asha V.");
    await page.getByTestId("save-profile").click();
    await expect(page.getByText("Profile saved")).toBeVisible();
    expect(called(mock, "PATCH", "/user/profile")[0].body).toEqual({ name: "Asha V." });
  });

  test("personalization saves preferences", async ({ page }) => {
    const mock = await setup(page);
    await page.goto("/settings/personalization");
    await page.getByTestId("about-me").fill("I run growth.");
    await page.getByRole("radio", { name: "Detailed" }).click();
    await page.getByLabel("Prefer tables for numbers").click();
    await page.getByTestId("save-preferences").click();
    await expect(page.getByText("Preferences saved")).toBeVisible();
    expect(called(mock, "PATCH", "/user/preferences")[0].body).toMatchObject({
      aboutMe: "I run growth.",
      responseStyle: "detailed",
      preferTables: true,
    });
  });

  test("models: server key error is shown inline, then a key saves", async ({ page }) => {
    const mock = await setup(page);
    await page.goto("/settings/models");
    await expect(page.getByTestId("models-list")).toBeVisible();
    await page.getByTestId("provider-openai").getByRole("button", { name: "Add key" }).click();
    await page.getByTestId("api-key-input").fill("sk-bad-key-1234567890");
    await page.getByTestId("save-key").click();
    await expect(page.getByRole("dialog")).toContainText("rejected this key");
    await page.getByTestId("api-key-input").fill("sk-good-key-1234567890");
    await page.getByTestId("save-key").click();
    await expect(page.getByTestId("provider-openai")).toContainText("Connected");
    expect(called(mock, "PUT", "/user/api-key").at(-1)?.body).toEqual({ provider: "openai", apiKey: "sk-good-key-1234567890" });
  });

  test("models: demo users can't add keys", async ({ page }) => {
    await setup(page, { user: { isDemo: true, email: null } });
    await page.goto("/settings/models");
    await expect(page.getByText("Keys can't be added in the demo")).toBeVisible();
    await expect(page.getByTestId("provider-openai").getByRole("button", { name: "Add key" })).toBeDisabled();
  });

  test("usage renders plans, stats, chart and limits", async ({ page }) => {
    await setup(page);
    await page.goto("/settings/usage");
    await expect(page.getByTestId("plan-free")).toContainText("Current plan");
    await expect(page.getByTestId("plan-byok")).toContainText("Unlimited answers");
    await expect(page.getByTestId("usage-stats")).toContainText("18 of 50");
    await expect(page.getByRole("img", { name: /Answers per day/ })).toBeVisible();
    await expect(page.getByTestId("limits-table")).toContainText("Rows per query");
  });

  test("privacy: export and delete all chats", async ({ page }) => {
    const mock = await setup(page);
    await page.goto("/settings/privacy");
    const download = page.waitForEvent("download");
    await page.getByTestId("export-data").click();
    expect((await download).suggestedFilename()).toMatch(/^wuup-export-.*\.json$/);
    await page.getByTestId("delete-chats").click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete all chats" }).click();
    await expect(page.getByText("All chats deleted")).toBeVisible();
    expect(called(mock, "DELETE", "/chats")).toHaveLength(1);
  });

  test("delete account needs DELETE typed and the password", async ({ page }) => {
    const mock = await setup(page);
    await page.goto("/settings/privacy");
    await page.getByTestId("delete-account").click();
    const confirm = page.getByTestId("confirm-delete-account");
    await expect(confirm).toBeDisabled();
    await page.getByTestId("delete-confirm-input").fill("delete");
    await page.getByTestId("delete-password-input").fill("nope");
    await expect(confirm).toBeDisabled();
    await page.getByTestId("delete-confirm-input").fill("DELETE");
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(page.getByRole("alertdialog")).toContainText("That password is incorrect.");
    await page.getByTestId("delete-password-input").fill("correct-horse");
    await confirm.click();
    await expect(page).toHaveURL(/\/login/);
    expect(called(mock, "DELETE", "/user").at(-1)?.body).toEqual({ confirm: "DELETE", password: "correct-horse" });
  });
});
