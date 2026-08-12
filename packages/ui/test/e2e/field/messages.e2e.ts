// Import Third-party Dependencies
import { test, expect } from "@playwright/test";

// Import Internal Dependencies
import { gotoGallery } from "../support/gallery.ts";

test.describe("field messages", () => {
  test("use visible, aligned semantic badges", async({ page }) => {
    await gotoGallery(page, { example: "controls/number", chrome: "off" });

    const description = page.locator(
      '[data-state="default"] jolly-number .description'
    );
    const error = page.locator('[data-state="error"] jolly-number .error');
    const info = description.locator('jolly-icon[name="info"]');
    const warning = error.locator('jolly-icon[name="warning"]');

    for (const icon of [info, warning]) {
      await expect(icon).toHaveCSS("width", "14px");
      await expect(icon).toHaveCSS("height", "14px");
      await expect(icon).toHaveCSS("margin-block-start", "0px");
    }

    for (const message of [description, error]) {
      await expect(message).toHaveCSS("margin-block-end", "2px");
    }

    expect(
      await info.evaluate((node) => getComputedStyle(node).color)
    ).not.toBe(
      await description.evaluate((node) => getComputedStyle(node).color)
    );
    expect(
      await info.locator("svg > circle").first()
        .evaluate((node) => getComputedStyle(node).fill)
    ).toBe(
      await info.evaluate((node) => getComputedStyle(node).color)
    );
    expect(
      await warning.locator("svg > path").first()
        .evaluate((node) => getComputedStyle(node).fill)
    ).toBe(
      await warning.evaluate((node) => getComputedStyle(node).color)
    );
  });

  test("property-row descriptions use the same rhythm", async({ page }) => {
    await gotoGallery(page, { example: "controls/chrome", chrome: "off" });

    const description = page.locator("jolly-property-row .description");
    const info = description.locator('jolly-icon[name="info"]');

    await expect(info).toHaveCSS("width", "14px");
    await expect(info).toHaveCSS("margin-block-start", "0px");
    await expect(description).toHaveCSS("margin-block-end", "2px");
  });
});
