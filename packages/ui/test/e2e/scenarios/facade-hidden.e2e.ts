// Import Third-party Dependencies
import {
  test,
  expect
} from "@playwright/test";

// Import Internal Dependencies
import {
  openExample,
  reloadGallery
} from "../support/gallery.ts";

test("a pane facade created hidden stays hidden until toggled, then remembers", async({ page }) => {
  await openExample(page, "scenarios/facade-hidden");

  const frame = page.locator("jolly-floating");
  await expect(frame).toBeHidden();
  await reloadGallery(page);
  await expect(frame).toBeHidden();

  await page.locator("[data-action='toggle-pane']").click();
  await expect(frame).toBeVisible();
  await reloadGallery(page);
  await expect(frame).toBeVisible();
});
