// Import Third-party Dependencies
import {
  test,
  expect
} from "@playwright/test";

// Import Internal Dependencies
import {
  gotoGallery,
  reloadGallery
} from "../support/gallery.ts";

test.describe("Pane facade hidden option", () => {
  test("starts hidden until toggled, then remembers", async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/facade-hidden",
      chrome: "off"
    });

    const frame = page.locator("jolly-floating");
    await expect(frame).toBeHidden();

    await reloadGallery(page);
    await expect(frame).toBeHidden();

    await page.locator("[data-action='toggle-pane']").click();
    await expect(frame).toBeVisible();

    await reloadGallery(page);
    await expect(frame).toBeVisible();
  });
});
