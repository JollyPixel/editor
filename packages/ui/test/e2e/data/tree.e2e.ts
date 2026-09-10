// Import Third-party Dependencies
import {
  test,
  expect
} from "@playwright/test";

// Import Internal Dependencies
import { gotoGallery } from "../support/gallery.ts";

test.describe("Tree badges", () => {
  test("renders one labelled dot per badge, in order", async({ page }) => {
    await gotoGallery(page, {
      example: "data/tree",
      chrome: "off"
    });

    const badges = page.locator('jolly-tree .row[data-id="camera"] .badge');

    await expect(badges).toHaveCount(2);
    await expect(badges.nth(0)).toHaveAttribute("aria-label", "Ada");
    await expect(badges.nth(1)).toHaveAttribute("aria-label", "Lin");
    expect(
      await badges.nth(0).evaluate((element) => getComputedStyle(element)
        .backgroundColor)
    ).toBe("rgb(224, 86, 122)");
  });

  test("renders no badge container on a row without badges", async({ page }) => {
    await gotoGallery(page, {
      example: "data/tree",
      chrome: "off"
    });

    await expect(
      page.locator('jolly-tree .row[data-id="scene"] .badges')
    ).toHaveCount(0);
  });
});

test.describe("Tree indent guides", () => {
  test("widens the guide band by one indent unit per ancestor", async({ page }) => {
    await gotoGallery(page, {
      example: "data/tree",
      chrome: "off"
    });

    const rootWidth = await page.locator('jolly-tree .row[data-id="scene"]')
      .evaluate((element) => getComputedStyle(element, "::before").width);
    const nestedWidth = await page.locator('jolly-tree .row[data-id="camera"]')
      .evaluate((element) => getComputedStyle(element, "::before").width);

    expect(rootWidth).toBe("0px");
    expect(nestedWidth).toBe("16px");
  });
});
