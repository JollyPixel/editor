// Import Third-party Dependencies
import { test, expect } from "@playwright/test";

// Import Internal Dependencies
import { gotoGallery } from "../support/gallery.ts";

test.describe("Progress", () => {
  test("exposes determinate and indeterminate values", async({ page }) => {
    await gotoGallery(page, {
      example: "feedback/progress",
      chrome: "off"
    });

    const empty = page.getByRole("progressbar", { name: "Empty" });
    const busy = page.getByRole("progressbar", { name: "Busy" });

    await expect(empty).toHaveAttribute("aria-valuemin", "0");
    await expect(empty).toHaveAttribute("aria-valuemax", "100");
    await expect(empty).toHaveAttribute("aria-valuenow", "0");
    await expect(busy).not.toHaveAttribute("aria-valuenow");
  });

  test("runs and resets the many-asset simulation", async({ page }) => {
    await gotoGallery(page, {
      example: "feedback/progress",
      chrome: "off"
    });

    const aggregate = page.getByRole("progressbar", {
      name: "Aggregate asset progress"
    });
    await page.locator("[data-action=start-loading]").click();
    await expect.poll(
      () => aggregate.getAttribute("aria-valuenow")
    ).not.toBe("0");
    await page.locator("[data-action=reset-loading]").click();
    await expect(aggregate).toHaveAttribute("aria-valuenow", "0");
    await expect(page.locator(".loading-preview jolly-loading"))
      .toHaveCount(1);
  });

  test("shows a fatal loading error", async({ page }) => {
    await gotoGallery(page, {
      example: "feedback/progress",
      chrome: "off"
    });

    await page.locator("[data-action=fail-loading]").click();
    await expect(page.getByRole("alert"))
      .toContainText("Unable to decode textures/world-atlas.png");
    await expect(page.locator(".loading-preview pre.error"))
      .toContainText("Unsupported texture encoding");
  });

  test("holds an empty load long enough to inspect", async({ page }) => {
    await gotoGallery(page, {
      example: "feedback/progress",
      chrome: "off"
    });

    const loading = page.locator(".loading-preview jolly-loading");
    await page.locator("[data-action=empty-loading]").click();
    await page.waitForTimeout(1_000);
    await expect(loading).toHaveCount(1);
    await expect(loading.getByRole("progressbar"))
      .toHaveAttribute("aria-valuenow", "0");
    await expect(loading).toHaveCount(0, { timeout: 4_000 });
  });
});
