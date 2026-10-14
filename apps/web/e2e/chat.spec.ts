import type { Page, Route } from "@playwright/test";
import { expect, test } from "./fixtures";
import { startChatScenarios } from "./mock-api/chat-scenarios.mjs";

/*
 * Chat experience against the mock API (plus chat-scenarios.mjs for slow and
 * exact-text streams). Each test gets its own mock state via its token.
 */

type Scenarios = { url: string; close: () => Promise<void> };
let scenarios: Scenarios;

test.beforeAll(async () => {
  scenarios = (await startChatScenarios()) as Scenarios;
});
test.afterAll(async () => {
  await scenarios?.close();
});

const composer = (page: Page) => page.getByRole("textbox", { name: "Message wuup" });

async function ask(page: Page, text: string) {
  await composer(page).fill(text);
  await composer(page).press("Enter");
}

/** Sends POST /chats/:id/messages (and /stop) to a chat-scenarios stream. */
async function routeStream(page: Page, kind: "slow" | "fence") {
  await page.route(/\/chats\/[^/]+\/messages$/, async (route: Route) => {
    if (route.request().method() !== "POST") return route.fallback();
    const chatId = /\/chats\/([^/]+)\/messages$/.exec(route.request().url())?.[1] ?? "x";
    await route.continue({ url: `${scenarios.url}/stream/${kind}?chatId=${chatId}` });
  });
  await page.route(/\/chats\/[^/]+\/stop$/, async (route: Route) => {
    const chatId = /\/chats\/([^/]+)\/stop$/.exec(route.request().url())?.[1] ?? "x";
    await route.continue({ url: `${scenarios.url}/stop?chatId=${chatId}` });
  });
}

test.describe("chat", () => {
  test("new chat streams an answer and lands on /chat/:id", async ({ page }) => {
    await page.goto("/chat");
    await ask(page, "What was paid revenue by month since May?");
    await expect(page).toHaveURL(/\/chat\/[a-f0-9]{24}$/);
    await expect(page.getByTestId("follow-ups")).toBeVisible();
    await expect(page.getByRole("article").getByText("36% rise")).toBeVisible();
    // The composer kept focus through the navigation.
    await expect(composer(page)).toBeFocused();
  });

  test("the optimistic question survives a delayed GET", async ({ page }) => {
    await page.route(/\/chats\/[^/]+\/messages(\?.*)?$/, async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      await new Promise((r) => setTimeout(r, 3000));
      await route.fallback();
    });
    await page.goto("/chat");
    await ask(page, "Delayed question about refunds");
    await expect(page).toHaveURL(/\/chat\/[a-f0-9]{24}$/);
    const bubble = page.locator('[data-role="user"]').filter({ hasText: "Delayed question about refunds" });
    await expect(bubble).toBeVisible();
    await page.waitForTimeout(3500);
    await expect(bubble).toBeVisible();
    await expect(page.getByTestId("follow-ups")).toBeVisible();
  });

  test("a double submit makes one POST", async ({ page }) => {
    let creates = 0;
    let sends = 0;
    page.on("request", (r) => {
      if (r.method() !== "POST") return;
      if (/\/chats$/.test(r.url())) creates++;
      if (/\/chats\/[^/]+\/messages$/.test(r.url())) sends++;
    });
    await page.goto("/chat");
    await composer(page).fill("Only once please");
    await composer(page).press("Enter");
    await composer(page).fill("Only once please");
    await composer(page).press("Enter");
    await expect(page.getByTestId("follow-ups")).toBeVisible();
    expect(creates).toBe(1);
    expect(sends).toBe(1);
  });

  test("switching chats mid-stream leaves both chats intact", async ({ page, isMobile }) => {
    test.skip(isMobile, "uses the docked sidebar");
    await routeStream(page, "slow");
    await page.goto("/chat");
    await ask(page, "Long answer please");
    await expect(page).toHaveURL(/\/chat\/[a-f0-9]{24}$/);
    const streamingUrl = page.url();
    await expect(page.getByText("Line 3 of a long answer")).toBeVisible();

    await page.getByRole("link", { name: "Churned customers in Q3" }).click();
    await expect(page).not.toHaveURL(streamingUrl);
    await expect(page.locator('[data-role="user"]').first()).toContainText("paid revenue by month");
    await page.waitForTimeout(600);
    // The background stream never writes into this chat.
    await expect(page.getByText(/Line \d+ of a long answer/)).toHaveCount(0);

    // Back (client-side): the stream kept running in the background.
    await page.goBack();
    await expect(page).toHaveURL(streamingUrl);
    await expect(page.locator('[data-role="user"]').filter({ hasText: "Long answer please" })).toBeVisible();
    await expect(page.getByText(/Line \d+ of a long answer/).first()).toBeVisible();
  });

  test("scrolling up mid-stream keeps position and shows Jump to latest", async ({ page }) => {
    await routeStream(page, "slow");
    await page.goto("/chat");
    await ask(page, "Long answer please");
    await expect(page.getByText("Line 12 of a long answer")).toBeVisible();
    const region = page.getByRole("region", { name: "Conversation" });
    await region.hover();
    await page.mouse.wheel(0, -600);
    await expect(page.getByRole("button", { name: "Jump to latest" })).toBeVisible();
    const top = await region.evaluate((el) => el.scrollTop);
    await page.waitForTimeout(800);
    const after = await region.evaluate((el) => el.scrollTop);
    expect(Math.abs(after - top)).toBeLessThan(4);
    await page.getByRole("button", { name: "Jump to latest" }).click();
    await expect(page.getByRole("button", { name: "Jump to latest" })).toBeHidden();
  });

  test("Stop ends the answer with a Stopped badge", async ({ page }) => {
    await routeStream(page, "slow");
    await page.goto("/chat");
    await ask(page, "Long answer please");
    await expect(page.getByText("Line 4 of a long answer")).toBeVisible();
    await page.getByRole("button", { name: "Stop answering" }).click();
    await expect(page.getByTestId("stopped-badge")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send message" })).toBeVisible();
  });

  test("[1] inside code stays literal while [1] in text becomes a citation", async ({ page }) => {
    await routeStream(page, "fence");
    await page.goto("/chat");
    await ask(page, "Show me code");
    const answer = page.locator('[data-role="assistant"]').last();
    await expect(answer.locator("pre")).toContainText("const first = rows[1];");
    await expect(answer.locator("code", { hasText: "arr[1]" })).toBeVisible();
    await expect(answer.locator("button[data-citation]")).toHaveCount(1);
  });
});

test.describe("clarification", () => {
  test.use({ scenario: "clarification" });

  test("digit hotkeys pick an option, but not while typing; Enter sends once", async ({ page }) => {
    let sends = 0;
    page.on("request", (r) => {
      if (r.method() === "POST" && /\/chats\/[^/]+\/messages$/.test(r.url())) sends++;
    });
    await page.goto("/chat");
    await ask(page, "How much revenue did we make?");
    const card = page.getByTestId("clarification");
    await expect(card).toBeVisible();
    expect(sends).toBe(1);

    // Typing "2" in the answer field types, it does not pick option 2.
    const field = card.getByRole("textbox", { name: "Or type your own answer" });
    await field.click();
    await field.press("2");
    await expect(field).toHaveValue("2");
    await page.waitForTimeout(300);
    expect(sends).toBe(1);

    // Enter in the field submits exactly once.
    await field.fill("Net of refunds");
    await field.press("Enter");
    await expect(page.locator('[data-role="user"]').filter({ hasText: "Net of refunds" })).toBeVisible();
    await page.waitForTimeout(500);
    expect(sends).toBe(2);

    // On the next card, the hotkey sends option 2.
    const next = page.getByTestId("clarification");
    await expect(next).toBeVisible();
    await next.getByRole("button", { name: /Gross order value/ }).focus();
    await page.keyboard.press("2");
    await expect(page.locator('[data-role="user"]').filter({ hasText: "Paid revenue after refunds" })).toBeVisible();
    expect(sends).toBe(3);
  });
});

test.describe("stream error", () => {
  test.use({ scenario: "streamError" });

  test("a mid-stream error renders inline with Try again", async ({ page }) => {
    await page.goto("/chat");
    await ask(page, "Revenue by month?");
    const err = page.getByTestId("answer-error");
    await expect(err).toBeVisible();
    await expect(err).toContainText("The model stopped responding");
    await expect(err.getByRole("button", { name: "Try again" })).toBeVisible();
    // The partial text that arrived is kept above the error.
    await expect(page.locator('[data-role="assistant"]').last()).toContainText("Paid revenue grew from");
  });
});

test.describe("free tier", () => {
  test.use({ scenario: "freeTierExhausted" });

  test("shows the free-limit card", async ({ page }) => {
    await page.goto("/chat");
    await ask(page, "Revenue by month?");
    const card = page.getByTestId("free-limit");
    await expect(card).toBeVisible();
    await expect(card).toContainText("You've used all 50 free answers.");
    await expect(card.getByRole("link", { name: "Add key" })).toHaveAttribute("href", "/settings/models");
  });
});
