// Import Third-party Dependencies
import {
  test,
  expect
} from "@playwright/test";
import { fieldRow as row } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import { openExample } from "../support/gallery.ts";
import { styleOf } from "../support/styles.ts";

test.describe("colored fields", () => {
  test.beforeEach(async({ page }) => {
    await openExample(page, "controls/checkbox");
  });

  test("the modified gutter follows the field color mode", async({ page }) => {
    const shadows: string[] = [];
    for (const state of ["modified", "colored+modified"]) {
      const field = row(page, "jolly-checkbox", state);
      const paint = await styleOf(field.locator("input"), "accent-color");
      const shadow = await styleOf(field, "box-shadow");

      expect(shadow).toContain(paint);
      shadows.push(shadow);
    }

    expect(shadows[0]).not.toBe(shadows[1]);
  });

  test("the neutral paint is muted in light and near-white in dark", async({ page }) => {
    const field = row(page, "jolly-checkbox", "default");
    const box = field.locator("input");
    const lightPaint = await styleOf(box, "accent-color");

    expect(lightPaint).toBe(await styleOf(field.locator(".label"), "color"));

    await page.locator("gallery-root").evaluate(
      (root) => root.setAttribute("theme", "dark")
    );
    await expect.poll(() => styleOf(box, "accent-color")).not.toBe(lightPaint);
    expect(await styleOf(box, "accent-color"))
      .toBe(await styleOf(field, "color"));
  });

  test("a root accent override reaches only colored fields", async({ page }) => {
    const neutral = row(page, "jolly-checkbox", "default").locator("input");
    const colored = row(page, "jolly-checkbox", "colored").locator("input");
    const neutralBefore = await styleOf(neutral, "accent-color");

    await page.locator("gallery-root").evaluate((root: HTMLElement) => {
      root.style.setProperty("--jolly-accent-fill", "rgb(255, 102, 0)");
    });

    await expect(colored).toHaveCSS("accent-color", "rgb(255, 102, 0)");
    await expect(neutral).toHaveCSS("accent-color", neutralBefore);
  });
});
