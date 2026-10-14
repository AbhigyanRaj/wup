import AxeBuilder from "@axe-core/playwright";
import { expect, expireSession, isMobileProject, openSidebar, test } from "./fixtures";

const APP_PAGE = "/data";

test.describe("unauthenticated", () => {
  test.use({ signedIn: false });

  test("app routes redirect to /login with next", async ({ page }) => {
    await page.goto(APP_PAGE);
    await expect(page).toHaveURL(/\/login\?next=%2Fdata/, { timeout: 45_000 });
  });
});

test.describe("stale session", () => {
  test.use({ scenario: "unauthorized" });

  test("a cookie without a valid session goes to /login", async ({ page }) => {
    await page.goto(APP_PAGE);
    await expect(page).toHaveURL(/\/login\?next=%2Fdata/, { timeout: 45_000 });
  });
});

test.describe("shell", () => {
  test("sidebar renders nav, grouped chats, usage and account", async ({ page }) => {
    await page.goto(APP_PAGE);
    const sidebar = await openSidebar(page);
    await expect(sidebar.getByRole("link", { name: "New chat" })).toBeVisible();
    await expect(sidebar.getByRole("button", { name: /Search/ })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /Data sources/ })).toHaveAttribute("aria-current", "page");
    // withData has a bridge in error: the red dot is announced.
    await expect(sidebar.getByRole("img", { name: "A data source needs attention" })).toBeVisible();
    await expect(sidebar.getByRole("heading", { name: "Pinned" })).toBeVisible();
    await expect(sidebar.getByRole("heading", { name: "Today" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Churned customers in Q3" })).toBeVisible();
    await expect(sidebar.getByText("38 of 50 free answers left")).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Add your own key" })).toHaveAttribute("href", "/settings/models");
    await expect(sidebar.getByText("Asha Verma")).toBeVisible();
  });

  test("command palette opens, filters and navigates", async ({ page }) => {
    test.skip(isMobileProject(page), "keyboard shortcut is desktop only");
    await page.goto(APP_PAGE);
    await expect(page.getByRole("link", { name: "Churned customers in Q3" })).toBeVisible();
    await page.keyboard.press("ControlOrMeta+k");
    const palette = page.getByRole("dialog", { name: "Search and commands" });
    await expect(palette).toBeVisible();
    await palette.getByRole("combobox").fill("late deliv");
    const option = palette.getByRole("option", { name: /Late deliveries last week/ });
    await expect(option).toBeVisible();
    await expect(palette.getByRole("option", { name: "Connect data" })).toHaveCount(0);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/chat\/[a-f0-9]+$/);
  });

  test("the Search item opens the palette", async ({ page }) => {
    await page.goto(APP_PAGE);
    const sidebar = await openSidebar(page);
    await sidebar.getByRole("button", { name: /Search/ }).click();
    await expect(page.getByRole("dialog", { name: "Search and commands" })).toBeVisible();
  });

  test("rename a chat inline", async ({ page }) => {
    await page.goto(APP_PAGE);
    const sidebar = await openSidebar(page);
    await sidebar.getByRole("button", { name: "Options for Churned customers in Q3" }).click();
    await page.getByRole("menuitem", { name: "Rename" }).click();
    const input = sidebar.getByRole("textbox", { name: "Chat title" });
    await expect(input).toBeFocused();
    await input.fill("Q3 churn deep dive");
    await input.press("Enter");
    await expect(sidebar.getByRole("link", { name: "Q3 churn deep dive" })).toBeVisible();

    // Esc cancels.
    await sidebar.getByRole("button", { name: "Options for Q3 churn deep dive" }).click();
    await page.getByRole("menuitem", { name: "Rename" }).click();
    await sidebar.getByRole("textbox", { name: "Chat title" }).fill("Discard me");
    await page.keyboard.press("Escape");
    await expect(sidebar.getByRole("link", { name: "Q3 churn deep dive" })).toBeVisible();

    // Persisted on the server.
    await page.reload();
    const again = await openSidebar(page);
    await expect(again.getByRole("link", { name: "Q3 churn deep dive" })).toBeVisible();
  });

  test("pin moves a chat into Pinned", async ({ page }) => {
    await page.goto(APP_PAGE);
    const sidebar = await openSidebar(page);
    await sidebar.getByRole("button", { name: "Options for Late deliveries last week" }).click();
    await page.getByRole("menuitem", { name: "Pin" }).click();
    const pinned = sidebar.getByRole("region", { name: "Pinned" });
    await expect(pinned.getByRole("link", { name: "Late deliveries last week" })).toBeVisible();
  });

  test("delete asks for confirmation", async ({ page }) => {
    await page.goto(APP_PAGE);
    const sidebar = await openSidebar(page);
    await sidebar.getByRole("button", { name: "Options for Refund rate by payment method" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    const confirm = page.getByRole("alertdialog", { name: "Delete this chat?" });
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText("You can't undo this.");
    await confirm.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Chat deleted")).toBeVisible();
    await expect(page.getByRole("link", { name: "Refund rate by payment method" })).toHaveCount(0);
  });

  test("a 401 mid-session redirects to /login with reason=expired", async ({ page, token }) => {
    await page.goto(APP_PAGE);
    const sidebar = await openSidebar(page);
    await expect(sidebar.getByRole("link", { name: "Churned customers in Q3" })).toBeVisible();
    await expireSession(token);
    await sidebar.getByRole("button", { name: "Options for Churned customers in Q3" }).click();
    await page.getByRole("menuitem", { name: "Pin" }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Fdata&reason=expired/, { timeout: 45_000 });
  });

  test("collapsed rail persists", async ({ page }) => {
    test.skip(isMobileProject(page), "rail is desktop only");
    await page.goto(APP_PAGE);
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  });

  test("shell has no serious axe violations", async ({ page }) => {
    await page.goto(APP_PAGE);
    await openSidebar(page);
    const results = await new AxeBuilder({ page })
      .include(isMobileProject(page) ? '[role="dialog"]' : 'aside[aria-label="Sidebar"]')
      .analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  });
});

test.describe("first run", () => {
  test.use({ scenario: "newUser" });

  test("welcome dialog shows once and records it", async ({ page }) => {
    await page.goto(APP_PAGE);
    const dialog = page.getByRole("dialog", { name: /Welcome to wuup/ });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Explore first" }).click();
    await expect(dialog).toBeHidden();
    await page.reload();
    await page.waitForTimeout(1000);
    await expect(page.getByRole("dialog", { name: /Welcome to wuup/ })).toHaveCount(0);
  });
});
