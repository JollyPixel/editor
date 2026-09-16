// Import Third-party Dependencies
import {
  test,
  expect
} from "@playwright/test";

// Import Internal Dependencies
import { openExample } from "../support/gallery.ts";
import { runUntilGone } from "../support/clock.ts";
import { boxOf } from "../support/pointer.ts";
import { styleOf } from "../support/styles.ts";

test.describe("Log", () => {
  test.beforeEach(async({ page }) => {
    await page.clock.install();
    await openExample(page, "feedback/log");
  });

  test("stacks the newest entry at the bottom", async({ page }) => {
    const status = page.locator("[data-action=log-status]");
    await status.click();
    await status.click();

    const rows = page.locator("jolly-log .content");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("Camera switched to pivot");
    await expect(rows.nth(1)).toContainText("Camera switched to free fly");
    expect((await boxOf(rows.nth(0))).y)
      .toBeGreaterThan((await boxOf(rows.nth(1))).y);
  });

  test("colours a peer name inside an entry", async({ page }) => {
    await page.locator("[data-action=log-join]").click();

    const name = page.locator("jolly-log .content b");
    await expect(name).toHaveText("Ada");
    expect(await styleOf(name, "color")).not.toBe("rgb(0, 0, 0)");
  });

  test("announces politely and reflects empty until cleared", async({ page }) => {
    const log = page.locator("jolly-log");
    await expect(log).toHaveAttribute("role", "log");
    await expect(log).toHaveAttribute("aria-live", "polite");
    await expect(log).toHaveAttribute("aria-relevant", "additions");
    await expect(log).toHaveAttribute("empty", "");

    await page.locator("[data-action=log-status]").click();
    await expect(log).not.toHaveAttribute("empty", "");

    await page.locator("[data-action=log-clear]").click();
    await runUntilGone(page, log.locator(".content"));
    await expect(log).toHaveAttribute("empty", "");
  });

  test("caps the queue and drains after the grace period", async({ page }) => {
    await page.locator("[data-action=log-burst]").click();

    const rows = page.locator("jolly-log .content");
    await expect(rows).toHaveCount(5);
    await expect(rows.nth(0)).toContainText("Burst message 6");

    await page.clock.runFor(5_000);
    await expect(rows).toHaveCount(5);
    await runUntilGone(page, rows);
  });
});
