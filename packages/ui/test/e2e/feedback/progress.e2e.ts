// Import Third-party Dependencies
import {
  test,
  expect
} from "@playwright/test";

// Import Internal Dependencies
import { openExample } from "../support/gallery.ts";
import { runUntilGone } from "../support/clock.ts";

test.describe("Progress", () => {
  test("exposes determinate and indeterminate values", async({ page }) => {
    await openExample(page, "feedback/progress");

    const empty = page.getByRole("progressbar", { name: "Empty" });
    await expect(empty).toHaveAttribute("aria-valuemin", "0");
    await expect(empty).toHaveAttribute("aria-valuemax", "100");
    await expect(empty).toHaveAttribute("aria-valuenow", "0");
    await expect(page.getByRole("progressbar", { name: "Busy" }))
      .not.toHaveAttribute("aria-valuenow");
  });

  test("runs and resets the many-asset simulation", async({ page }) => {
    await openExample(page, "feedback/progress");

    const aggregate = page.getByRole("progressbar", {
      name: "Aggregate asset progress"
    });
    await page.locator("[data-action=start-loading]").click();
    await expect(aggregate).not.toHaveAttribute("aria-valuenow", "0");

    await page.locator("[data-action=reset-loading]").click();
    await expect(aggregate).toHaveAttribute("aria-valuenow", "0");
    await expect(page.locator(".loading-preview jolly-loading")).toHaveCount(1);
  });

  test("shows a fatal loading error with its cause", async({ page }) => {
    await openExample(page, "feedback/progress");

    await page.locator("[data-action=fail-loading]").click();
    await expect(page.getByRole("alert"))
      .toContainText("Unable to decode textures/world-atlas.png");
    await expect(page.locator(".loading-preview pre.error"))
      .toContainText("Unsupported texture encoding");
  });

  test("an empty load holds at zero, then completes and unmounts", async({ page }) => {
    await page.clock.install();
    await openExample(page, "feedback/progress");

    const loading = page.locator(".loading-preview jolly-loading");
    await page.locator("[data-action=empty-loading]").click();
    await page.clock.runFor(1_000);

    await expect(loading).toHaveCount(1);
    await expect(loading.getByRole("progressbar"))
      .toHaveAttribute("aria-valuenow", "0");
    await runUntilGone(page, loading);
  });
});
