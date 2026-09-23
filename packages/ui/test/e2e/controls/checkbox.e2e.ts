// Import Third-party Dependencies
import {
  test,
  expect,
  type Locator
} from "@playwright/test";
import { fieldRow as row, boxOf } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import { openExample } from "../support/gallery.ts";
import {
  fieldChanges,
  recordFieldChanges
} from "../support/events.ts";
import { styleOf } from "../support/styles.ts";

function gradientOf(
  field: Locator
): Promise<Record<string, string>> {
  return field.locator(".checkbox").evaluate((element) => {
    const style = getComputedStyle(element, "::before");

    return {
      image: style.backgroundImage,
      top: style.top,
      bottom: style.bottom,
      topLeft: style.borderTopLeftRadius,
      topRight: style.borderTopRightRadius,
      bottomLeft: style.borderBottomLeftRadius,
      bottomRight: style.borderBottomRightRadius
    };
  });
}

test.describe("checkbox", () => {
  test.beforeEach(async({ page }) => {
    await openExample(page, "controls/checkbox");
    await recordFieldChanges(page);
  });

  test("real clicks toggle without the native rollback race", async({ page }) => {
    const box = row(page, "jolly-checkbox", "default").locator("input");

    await box.click();
    await expect(box).toBeChecked();
    await box.click();
    await expect(box).not.toBeChecked();

    expect(await fieldChanges(page)).toEqual([true, false]);
  });

  test("a mixed checkbox is indeterminate and resolves to true", async({ page }) => {
    const box = row(page, "jolly-checkbox", "mixed").locator("input");

    expect(
      await box.evaluate((node: HTMLInputElement) => node.indeterminate)
    ).toBe(true);
    await box.click();
    await expect(box).toBeChecked();

    expect(await fieldChanges(page)).toEqual([true]);
  });

  test("clicking the background away from the box toggles it", async({ page }) => {
    const field = row(page, "jolly-checkbox", "default");
    const target = field.locator(".checkbox");
    const [targetBox, inputBox] = await Promise.all([
      boxOf(target),
      boxOf(field.locator("input"))
    ]);
    expect(targetBox.width).toBeGreaterThan(inputBox.width);

    const resting = await styleOf(target, "background-image", "::before");
    await target.hover();
    await expect.poll(
      () => styleOf(target, "background-image", "::before")
    ).not.toBe(resting);

    await target.click({
      position: {
        x: targetBox.width - 2,
        y: targetBox.height / 2
      }
    });
    await expect(field.locator("input")).toBeChecked();
  });

  test("inert states refuse both the box and the background", async({ page }) => {
    for (const state of ["disabled", "readonly", "locked"]) {
      const field = row(page, "jolly-checkbox", state);
      const input = field.locator("input");

      await input.click({ force: true });
      await field.locator(".checkbox").click({ force: true });
      await expect(input).not.toBeChecked();
    }

    expect(await fieldChanges(page)).toEqual([]);
  });

  test("the background gradient mirrors with alignment", async({ page }) => {
    const field = row(page, "jolly-checkbox", "default");
    const value = field.locator(".value");
    const input = field.locator("input");

    await expect(field).toHaveAttribute("clickable-background", "");
    const start = await gradientOf(field);
    const [startValue, startInput] = await Promise.all([
      boxOf(value),
      boxOf(input)
    ]);
    expect(start).toMatchObject({
      top: "2px",
      bottom: "2px",
      topLeft: "2px",
      bottomLeft: "2px",
      topRight: "0px",
      bottomRight: "0px"
    });
    expect(startInput.x - startValue.x).toBe(4);

    await field.evaluate((element) => element.setAttribute("align", "end"));
    await expect.poll(() => gradientOf(field)).toMatchObject({
      topLeft: "0px",
      bottomLeft: "0px",
      topRight: "2px",
      bottomRight: "2px"
    });
    const end = await gradientOf(field);
    const [endValue, endInput] = await Promise.all([
      boxOf(value),
      boxOf(input)
    ]);
    expect(end.image).not.toBe(start.image);
    expect(endValue.width).toBe(startValue.width);
    expect(
      (endValue.x + endValue.width) - (endInput.x + endInput.width)
    ).toBe(4);
  });

  test("the expanded background is opt-in", async({ page }) => {
    const field = row(page, "jolly-checkbox", "default");

    expect(
      await field.evaluate(
        () => document.createElement("jolly-checkbox").clickableBackground
      )
    ).toBe(false);

    await field.evaluate(
      (element) => element.removeAttribute("clickable-background")
    );
    await expect(field.locator(".checkbox"))
      .not.toHaveCSS("position", "relative");

    const [value, input] = await Promise.all([
      boxOf(field.locator(".value")),
      boxOf(field.locator("input"))
    ]);
    expect(input.x).toBe(value.x);
  });
});

test.describe("flags", () => {
  test("real clicks toggle one bit without the native rollback race", async({ page }) => {
    await openExample(page, "controls/flags");
    await recordFieldChanges(page);

    const box = row(page, "jolly-flags", "default").getByLabel("Player");
    await box.click();
    await expect(box).toBeChecked();
    await box.click();
    await expect(box).not.toBeChecked();

    expect(await fieldChanges(page)).toEqual([0b0111, 0b0101]);
  });
});

test("an end-aligned editor checkbox spans its value column apart from the label", async({ page }) => {
  await openExample(page, "scenarios/editor");

  const propertyRow = page.locator("jolly-property-row", {
    has: page.locator("jolly-checkbox")
  }).first();
  const label = propertyRow.locator(".label").first();
  const [rowBox, labelBox, valueBox, gradientBox, inputBox] = await Promise.all([
    boxOf(propertyRow.locator(".row").first()),
    boxOf(label),
    boxOf(propertyRow.locator(".value").first()),
    boxOf(propertyRow.locator("jolly-checkbox .checkbox")),
    boxOf(propertyRow.locator('input[type="checkbox"]'))
  ]);
  const inputRight = inputBox.x + inputBox.width;

  expect((rowBox.x + rowBox.width) - inputRight).toBe(8);
  expect(labelBox.x + labelBox.width).toBeLessThan(inputRight);
  await expect(label).toHaveCSS("text-align", "start");
  expect(gradientBox.width).toBeGreaterThan(inputBox.width * 3);
  expect(inputBox.x - gradientBox.x).toBeGreaterThan(valueBox.width / 2);
});
