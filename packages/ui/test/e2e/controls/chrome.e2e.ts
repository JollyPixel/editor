// Import Third-party Dependencies
import {
  test,
  expect
} from "@playwright/test";

// Import Internal Dependencies
import { openExample } from "../support/gallery.ts";
import { boxOf } from "../support/pointer.ts";
import { styleOf } from "../support/styles.ts";

test.describe("controls: chrome", () => {
  test("buttons, separators and property rows expose their content", async({ page }) => {
    await openExample(page, "controls/chrome");

    const search = page.locator("jolly-button", { hasText: "Search" });
    await expect(search.locator("jolly-icon")).toHaveCount(1);
    await expect(search).toHaveText("Search");

    const accent = page.locator('jolly-button[variant="accent"] button').first();
    const plain = page.locator('jolly-button[variant="default"] button').first();
    expect(await styleOf(accent, "background-color"))
      .not.toBe(await styleOf(plain, "background-color"));

    await expect(page.locator("jolly-button[disabled] button")).toBeDisabled();
    await expect(page.locator("jolly-button[icon-only] button"))
      .toHaveAttribute("aria-label", "Close");
    await expect(
      page.locator("jolly-separator").first().locator('[role="separator"]')
    ).toHaveAttribute("aria-label", "Grouping");

    const propertyRow = page.locator("jolly-property-row");
    await expect(propertyRow.locator("jolly-button")).toHaveCount(2);
    await expect(propertyRow.locator(".label")).toHaveText("Export");
    await expect(propertyRow).toHaveCSS("--jolly-label-width", "14ch");

    const description = propertyRow.locator(".description");
    const info = description.locator('jolly-icon[name="info"]');
    await expect(info).toHaveCSS("width", "14px");
    await expect(info).toHaveCSS("margin-block-start", "0px");
    await expect(description).toHaveCSS("margin-block-end", "2px");
  });

  test("a separator caption aligns with control labels", async({ page }) => {
    await openExample(page, "scenarios/editor");

    const palette = page.locator("jolly-floating");
    const labelled = palette.locator("jolly-separator .labelled");
    const caption = palette.locator("jolly-separator .caption");
    const fieldLabel = palette.locator("jolly-slider .label").first();
    const rules = labelled.locator(".rule");
    await expect(rules).toHaveCount(2);

    const [captionBox, labelBox, leading, trailing] = await Promise.all([
      boxOf(caption),
      boxOf(fieldLabel),
      boxOf(rules.first()),
      boxOf(rules.last())
    ]);
    expect(captionBox.x).toBe(labelBox.x);
    expect(captionBox.x - (leading.x + leading.width)).toBe(4);
    expect(trailing.x - (captionBox.x + captionBox.width)).toBe(4);

    expect(await styleOf(caption, "color"))
      .not.toBe(await styleOf(fieldLabel, "color"));
    await expect(caption).toHaveCSS(
      "font-size",
      await styleOf(fieldLabel, "font-size")
    );
    await expect(labelled).toHaveCSS("margin-block-start", "2px");

    const plainRule = page.locator("jolly-separator .unlabelled .rule").first();
    expect(await styleOf(rules.last(), "background-color"))
      .not.toBe(await styleOf(plainRule, "background-color"));
  });

  test("labelled and plain separators share one height", async({ page }) => {
    await openExample(page, "scenarios/editor");

    const separators = page.locator("jolly-separator");
    await expect(separators).toHaveCount(4);
    await expect(
      separators.locator('[role="separator"][aria-label]')
    ).toHaveCount(2);
    await expect(
      separators.locator('[role="separator"]:not([aria-label])')
    ).toHaveCount(2);

    const unlabelled = separators.locator(".unlabelled").first();
    const [labelledBox, unlabelledBox] = await Promise.all([
      boxOf(separators.locator(".labelled").first()),
      boxOf(unlabelled)
    ]);
    expect(unlabelledBox.height).toBe(labelledBox.height);
    await expect(unlabelled).toHaveCSS("margin-block-start", "2px");
  });
});
