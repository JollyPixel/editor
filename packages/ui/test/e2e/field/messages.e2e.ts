// Import Third-party Dependencies
import {
  test,
  expect
} from "@playwright/test";

// Import Internal Dependencies
import { openExample } from "../support/gallery.ts";
import { fieldRow as row } from "../support/locators.ts";
import { styleOf } from "../support/styles.ts";

test("field messages use visible, aligned semantic badges", async({ page }) => {
  await openExample(page, "controls/number");

  const description = row(page, "jolly-number", "default")
    .locator(".description");
  const error = row(page, "jolly-number", "error").locator(".error");
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

  const infoColor = await styleOf(info, "color");
  expect(infoColor).not.toBe(await styleOf(description, "color"));
  expect(await styleOf(info.locator("svg > circle").first(), "fill"))
    .toBe(infoColor);
  expect(await styleOf(warning.locator("svg > path").first(), "fill"))
    .toBe(await styleOf(warning, "color"));
});
