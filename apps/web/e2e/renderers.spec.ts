import { expect, test } from "@playwright/test";

/*
 * Answer renderers gallery (/renderers, dev only): every edge case renders
 * without console errors, and screenshots are captured at desktop and mobile.
 */

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

for (const vp of VIEWPORTS) {
  test(`renderers gallery renders cleanly (${vp.name})`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/renderers", { waitUntil: "load" });
    await expect(page.getByRole("heading", { level: 1, name: "Answer renderers" })).toBeVisible();

    // Charts are drawn (role=group + aria-roledescription=chart).
    await expect(page.locator('[aria-roledescription="chart"]').first()).toBeVisible({ timeout: 60_000 });
    expect(await page.locator('[aria-roledescription="chart"]').count()).toBeGreaterThanOrEqual(7);

    // Unknown type falls back to a table with the caption.
    await expect(page.getByText("Shown as a table").first()).toBeVisible();
    // All-zero pie.
    await expect(page.getByText("No values to chart")).toBeVisible();
    // Invalid mermaid shows the calm card.
    await expect(page.getByText("Couldn't draw this diagram")).toBeVisible({ timeout: 60_000 });
    // Valid mermaid draws an SVG.
    await expect(page.locator(".mermaid-svg svg").first()).toBeVisible({ timeout: 60_000 });

    // Keyboard: arrow keys move the focused point and announce it.
    const firstChart = page.locator('[aria-roledescription="chart"]').first();
    await firstChart.focus();
    await page.keyboard.press("ArrowRight");
    await expect(firstChart.locator('[aria-live="polite"]')).not.toHaveText("");

    // Numeric-string sort: 9 < 75 < 1,240, empties last.
    const sortCase = page.locator('[data-case^="Numeric-string sort"]');
    await sortCase.getByRole("button", { name: /units/i }).click();
    const units = await sortCase.locator("tbody tr td:nth-child(2)").allTextContents();
    expect(units.map((u) => u.trim())).toEqual(["9", "75", "1,240", ""]);
    await expect(sortCase.locator('th[aria-sort="ascending"]')).toHaveCount(1);

    // Rows accordion opens.
    await page.getByRole("button", { name: /View rows/ }).click();
    await expect(page.locator('[data-case^="visualType none"] table')).toBeVisible();

    await page.waitForTimeout(500);
    await page.screenshot({ path: testInfo.outputPath(`renderers-${vp.name}.png`), fullPage: true });

    expect(errors, errors.join("\n")).toEqual([]);
  });
}
