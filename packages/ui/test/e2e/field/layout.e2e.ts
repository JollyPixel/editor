// Import Third-party Dependencies
import {
  test,
  expect,
  type Locator
} from "@playwright/test";

// Import Internal Dependencies
import { gotoGallery } from "../support/gallery.ts";
import { fieldRow as row } from "../support/locators.ts";

/** Distance from each field edge to the input it wraps. */
async function insets(
  field: Locator
): Promise<{ start: number; end: number; }> {
  const outer = await field.boundingBox();
  const inner = await field.locator("input").boundingBox();
  expect(outer).not.toBeNull();
  expect(inner).not.toBeNull();

  return {
    start: Math.round(inner!.x - outer!.x),
    end: Math.round((outer!.x + outer!.width) - (inner!.x + inner!.width))
  };
}

test.describe("field: label-less layout", () => {
  test.beforeEach(async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/unlabeled-fields",
      chrome: "off"
    });
  });

  test("insets the value equally on both edges", async({ page }) => {
    const { start, end } = await insets(
      row(page, "jolly-text", "unlabeled")
    );

    expect(start).toBe(end);
  });

  test("keeps the label column when a label is set", async({ page }) => {
    const labelled = await insets(
      row(page, "jolly-text", "labelled")
    );
    const unlabeled = await insets(
      row(page, "jolly-text", "unlabeled")
    );

    expect(labelled.start).toBeGreaterThan(unlabeled.start);
  });

  test("keeps the lock clear of the value", async({ page }) => {
    const locked = row(page, "jolly-text", "unlabeled+locked");
    await expect(locked.locator(".gutter jolly-icon")).toBeVisible();

    const { start } = await insets(locked);
    const plain = await insets(
      row(page, "jolly-text", "unlabeled")
    );

    expect(start).toBeGreaterThan(plain.start);
  });

  test("drops the empty label line in stacked layout", async({ page }) => {
    const stacked = row(page, "jolly-text", "unlabeled+top");
    await expect(stacked.locator(".leading")).toBeHidden();

    const { start, end } = await insets(stacked);
    expect(start).toBe(end);
  });

  test("aligns help text with the value", async({ page }) => {
    const field = row(page, "jolly-text", "unlabeled+description");
    const description = field.locator(".description");
    const outer = await field.boundingBox();
    const inner = await field.locator("input").boundingBox();
    const text = await description.boundingBox();

    expect(Math.round(text!.x - outer!.x)).toBe(
      Math.round(inner!.x - outer!.x)
    );
  });
});
