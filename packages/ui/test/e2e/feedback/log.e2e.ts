// Import Third-party Dependencies
import { test, expect } from "@playwright/test";

// Import Internal Dependencies
import { gotoGallery } from "../support/gallery.ts";

test.describe("Log", () => {
  test("stacks the newest entry at the bottom", async({ page }) => {
    await gotoGallery(page, {
      example: "feedback/log",
      chrome: "off"
    });

    await page.locator("[data-action=log-status]").click();
    await page.locator("[data-action=log-status]").click();

    const rows = page.locator("jolly-log .content");
    await expect(rows).toHaveCount(2);

    const first = await rows.nth(0).boundingBox();
    const second = await rows.nth(1).boundingBox();
    expect(first?.y).toBeGreaterThan(second?.y ?? 0);
    await expect(rows.nth(0)).toContainText("Camera switched to pivot");
    await expect(rows.nth(1)).toContainText("Camera switched to free fly");
  });

  test("colours a peer name inside an entry", async({ page }) => {
    await gotoGallery(page, {
      example: "feedback/log",
      chrome: "off"
    });

    await page.locator("[data-action=log-join]").click();

    const name = page.locator("jolly-log .content b");
    await expect(name).toHaveText("Ada");
    const color = await name.evaluate(
      (element) => window.getComputedStyle(element).color
    );
    expect(color).not.toBe("rgb(0, 0, 0)");
  });

  test("caps the queue and drains after the grace period", async({ page }) => {
    await gotoGallery(page, {
      example: "feedback/log",
      chrome: "off"
    });

    await page.locator("[data-action=log-burst]").click();

    const rows = page.locator("jolly-log .content");
    await expect.poll(() => rows.count()).toBe(5);
    await expect(rows.nth(0)).toContainText("Burst message 6");

    await expect.poll(
      () => rows.count(),
      { timeout: 15_000 }
    ).toBe(0);
  });

  test("announces additions politely", async({ page }) => {
    await gotoGallery(page, {
      example: "feedback/log",
      chrome: "off"
    });

    const log = page.locator("jolly-log");
    await expect(log).toHaveAttribute("role", "log");
    await expect(log).toHaveAttribute("aria-live", "polite");
    await expect(log).toHaveAttribute("aria-relevant", "additions");
  });

  test("reflects empty until a row is rendered", async({ page }) => {
    await gotoGallery(page, {
      example: "feedback/log",
      chrome: "off"
    });

    const log = page.locator("jolly-log");
    await expect(log).toHaveAttribute("empty", "");

    await page.locator("[data-action=log-status]").click();
    await expect(log).not.toHaveAttribute("empty", "");

    await page.locator("[data-action=log-clear]").click();
    await expect(log).toHaveAttribute("empty", "");
  });

  test("clears every entry", async({ page }) => {
    await gotoGallery(page, {
      example: "feedback/log",
      chrome: "off"
    });

    await page.locator("[data-action=log-status]").click();
    await page.locator("[data-action=log-clear]").click();

    await expect.poll(
      () => page.locator("jolly-log .content").count()
    ).toBe(0);
  });
});
