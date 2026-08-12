// Import Third-party Dependencies
import {
  test,
  expect,
  type Locator
} from "@playwright/test";

// Import Internal Dependencies
import { gotoGallery } from "../support/gallery.ts";
import { fieldRow as row } from "../support/locators.ts";

// CONSTANTS
const kControls = [
  { id: "controls/checkbox", tag: "jolly-checkbox" },
  { id: "controls/slider", tag: "jolly-slider" },
  { id: "controls/flags", tag: "jolly-flags" }
];

function control(field: Locator): Locator {
  return field.locator('input:not([type="color"])').first();
}

async function paintOf(
  field: Locator,
  tag: string
): Promise<string> {
  if (tag === "jolly-slider") {
    return field.locator(".lane").evaluate(
      (node) => getComputedStyle(node, "::before").backgroundImage
    );
  }

  return control(field).evaluate(
    (node) => getComputedStyle(node).accentColor
  );
}

test.describe("colored fields", () => {
  test("supported controls are neutral by default and accent on opt-in", async({
    page
  }) => {
    for (const { id, tag } of kControls) {
      await gotoGallery(page, { example: id, chrome: "off" });

      const neutral = row(page, tag, "default");
      const colored = row(page, tag, "colored");

      await expect(neutral).toHaveJSProperty("colored", false);
      await expect(neutral).not.toHaveAttribute("colored", "");
      await expect(colored).toHaveJSProperty("colored", true);
      await expect(colored).toHaveAttribute("colored", "");
      expect(await paintOf(neutral, tag)).not.toBe(
        await paintOf(colored, tag)
      );
    }
  });

  test("the modified gutter follows the field color mode", async({ page }) => {
    await gotoGallery(page, {
      example: "controls/checkbox",
      chrome: "off"
    });

    for (const state of ["modified", "colored+modified"]) {
      const field = row(page, "jolly-checkbox", state);
      const activeColor = await control(field).evaluate(
        (node) => getComputedStyle(node).accentColor
      );
      const gutterColor = await field.evaluate(
        (node) => getComputedStyle(node).boxShadow
      );

      expect(gutterColor).toContain(activeColor);
    }

    const neutral = row(page, "jolly-checkbox", "modified");
    const colored = row(page, "jolly-checkbox", "colored+modified");

    expect(
      await neutral.evaluate((node) => getComputedStyle(node).boxShadow)
    ).not.toBe(
      await colored.evaluate((node) => getComputedStyle(node).boxShadow)
    );
  });

  test("the neutral paint is muted in light and near-white in dark", async({
    page
  }) => {
    await gotoGallery(page, {
      example: "controls/checkbox",
      chrome: "off"
    });

    const field = row(page, "jolly-checkbox", "default");
    const box = control(field);
    const lightPaint = await box.evaluate(
      (node) => getComputedStyle(node).accentColor
    );
    const mutedText = await field.locator(".label").evaluate(
      (node) => getComputedStyle(node).color
    );

    expect(lightPaint).toBe(mutedText);

    await page.evaluate(() => {
      document.querySelector("gallery-root")?.setAttribute("theme", "dark");
    });

    await expect.poll(
      () => box.evaluate((node) => getComputedStyle(node).accentColor)
    ).not.toBe(lightPaint);
    expect(
      await box.evaluate((node) => getComputedStyle(node).accentColor)
    ).toBe(
      await field.evaluate((node) => getComputedStyle(node).color)
    );
  });
});
