// Import Third-party Dependencies
import {
  test,
  expect
} from "@playwright/test";

// Import Internal Dependencies
import {
  gotoGallery,
  openExample,
  reloadGallery
} from "../support/gallery.ts";

test("a pane facade created hidden stays hidden until toggled, then remembers", async({ page }) => {
  await openExample(page, "scenarios/facade", {
    options: { hidden: true }
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

test("remounting the example disposes the floating pane's theme scope", async({ page }) => {
  await gotoGallery(page, { example: "scenarios/facade" });

  const scopes = page.locator("body > jolly-scope");
  await expect(scopes).toHaveCount(1);

  await page.locator("gallery-root .options [data-option=hidden] input").click();
  await expect(scopes).toHaveCount(1);
});

test("notes, appended elements and theme preferences mount inside the pane", async({ page }) => {
  await openExample(page, "scenarios/facade");

  const folder = page.locator("jolly-floating jolly-folder").first();
  await expect(folder.locator("jolly-property-row")).toHaveCount(1);
  await expect(folder.locator("[data-role='facade-readout']")).toHaveCount(1);
  await expect(
    page.locator("jolly-floating jolly-theme-preferences")
  ).toHaveCount(1);
});
