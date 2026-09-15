// Import Third-party Dependencies
import {
  test,
  expect
} from "@playwright/test";

// Import Internal Dependencies
import { gotoGallery } from "../../support/gallery.ts";

test.describe("Rail", () => {
  test("shows both layout orientations", async({ page }) => {
    await gotoGallery(page, {
      example: "containers/rail",
      chrome: "off"
    });

    const rails = page.locator("jolly-rail");
    await expect(rails).toHaveCount(2);
    await expect(rails.first()).toHaveAttribute("orientation", "vertical");
    await expect(rails.last()).toHaveAttribute("orientation", "horizontal");
  });
});
