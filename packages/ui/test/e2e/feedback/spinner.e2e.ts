// Import Third-party Dependencies
import { test, expect } from "@playwright/test";

// Import Internal Dependencies
import { gotoGallery } from "../support/gallery.ts";

test.describe("Spinner", () => {
  test("names each labelled indicator", async({ page }) => {
    await gotoGallery(page, {
      example: "feedback/spinner",
      chrome: "off"
    });

    await expect(page.getByRole("status", { name: "Inline" }))
      .toBeVisible();
    await expect(page.getByRole("status", { name: "Overlay" }))
      .toBeVisible();
  });

  test("shows a busy indicator for the duration of the work", async({ page }) => {
    await gotoGallery(page, {
      example: "feedback/spinner",
      chrome: "off"
    });

    const busy = page.locator("[data-role=scenario-spinner]");
    const trigger = page.locator("[data-action=start-busy]");

    await expect(busy).toBeHidden();
    await trigger.click();
    await expect(busy).toBeVisible();
    await expect(page.locator(".spinner-scenario .scenario-hint"))
      .toHaveText("Loading something...");
    await expect(busy).toBeHidden({ timeout: 5_000 });
    await expect(page.locator(".spinner-scenario .scenario-hint"))
      .toHaveText("Done.");
  });
});
