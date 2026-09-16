// Import Third-party Dependencies
import {
  test,
  expect
} from "@playwright/test";

// Import Internal Dependencies
import { openExample } from "../support/gallery.ts";

test.describe("Spinner", () => {
  test("names each labelled indicator as a status", async({ page }) => {
    await openExample(page, "feedback/spinner");

    await expect(page.getByRole("status", { name: "Inline" })).toBeVisible();
    await expect(page.getByRole("status", { name: "Overlay" })).toBeVisible();
  });

  test("the hidden attribute hides a busy indicator", async({ page }) => {
    await page.clock.install();
    await openExample(page, "feedback/spinner");

    const busy = page.locator("[data-role=scenario-spinner]");
    const hint = page.locator(".spinner-scenario .scenario-hint");
    await expect(busy).toBeHidden();

    await page.locator("[data-action=start-busy]").click();
    await expect(busy).toBeVisible();
    await expect(hint).toHaveText("Loading something...");

    await page.clock.runFor(2_000);
    await expect(busy).toBeHidden();
    await expect(hint).toHaveText("Done.");
  });
});
