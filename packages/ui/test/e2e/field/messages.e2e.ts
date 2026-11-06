// Import Third-party Dependencies
import type { Locator } from "@playwright/test";

// Import Internal Dependencies
import {
  test,
  expect
} from "../fixtures.ts";
import { fieldRow as row, openExample } from "../support/gallery.ts";
import { readStyle, resolveColor } from "../support/styles.ts";

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

  const infoColor = await readStyle(info, "color");
  expect(infoColor).not.toBe(await readStyle(description, "color"));
  expect(await readStyle(info.locator("svg > circle").first(), "fill"))
    .toBe(await glyphColor(info));
  expect(await readStyle(warning.locator("svg > path").first(), "fill"))
    .toBe(await glyphColor(warning));
});

async function glyphColor(icon: Locator): Promise<string> {
  const color = await readStyle(icon, "color");

  return resolveColor(icon.locator(".."), `color-mix(in oklab, ${color}, ${color})`);
}
