// Import Third-party Dependencies
import { boxOf } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  test,
  expect
} from "../fixtures.ts";
import { fieldRow as row } from "../support/gallery.ts";
import {
  fieldChanges,
  recordFieldChanges
} from "../support/events.ts";
import { styleOf } from "../support/styles.ts";

test.describe("toggle", () => {
  test.use({
    example: "controls/toggle"
  });

  test.beforeEach(async({ page }) => {
    await recordFieldChanges(page);
  });

  test("the label sits inside the box and names the switch", async({ page }) => {
    const field = row(page, "jolly-toggle", "default");
    const [box, text, knob] = await Promise.all([
      boxOf(field.locator(".toggle")),
      boxOf(field.locator(".text")),
      boxOf(field.locator(".switch"))
    ]);

    await expect(field).toHaveAttribute("unlabeled", "");
    await expect(field.locator(".label")).toHaveCount(0);
    await expect(field.locator(".text")).toHaveText("Cast shadows");
    await expect(field.getByRole("checkbox", { name: "Cast shadows" }))
      .toHaveCount(1);
    expect(text.x).toBeGreaterThan(box.x);
    expect(knob.x + knob.width).toBeLessThanOrEqual(box.x + box.width);
    expect(knob.x).toBeGreaterThan(text.x);
  });

  test("clicking the label or the switch toggles the value", async({ page }) => {
    const field = row(page, "jolly-toggle", "default");
    const input = field.getByRole("checkbox");

    await field.locator(".text").click();
    await expect(input).toBeChecked();
    await field.locator(".switch").click();
    await expect(input).not.toBeChecked();
    await input.focus();
    await page.keyboard.press("Space");
    await expect(input).toBeChecked();

    await expect.poll(() => fieldChanges(page)).toEqual([true, false, true]);
  });

  test("the knob slides to the end when on and centres when mixed", async({ page }) => {
    function knobLeft(
      state: string
    ): Promise<string> {
      return styleOf(
        row(page, "jolly-toggle", state).locator(".switch"),
        "left",
        "::before"
      );
    }
    const off = parseFloat(await knobLeft("default"));
    const mixed = parseFloat(await knobLeft("mixed"));
    const on = parseFloat(await knobLeft("modified"));

    expect(mixed).toBeGreaterThan(off);
    expect(on).toBeGreaterThan(mixed);
  });

  test("hovering an invalid toggle keeps the invalid tint", async({ page }) => {
    const valid = row(page, "jolly-toggle", "default").locator(".toggle");
    const invalid = row(page, "jolly-toggle", "error").locator(".toggle");

    const validRest = await styleOf(valid, "background-color");
    await valid.hover();
    await expect.poll(() => styleOf(valid, "background-color"))
      .not.toBe(validRest);
    const validHover = await styleOf(valid, "background-color");

    const invalidRest = await styleOf(invalid, "background-color");
    await invalid.hover();
    await expect.poll(() => styleOf(invalid, "background-color"))
      .not.toBe(invalidRest);
    expect(await styleOf(invalid, "background-color")).not.toBe(validHover);
  });

  test("the revert gutter sits before the box, not inside it", async({ page }) => {
    const field = row(page, "jolly-toggle", "modified");
    const [revert, box] = await Promise.all([
      boxOf(field.locator(".revert")),
      boxOf(field.locator(".toggle"))
    ]);

    await expect(field.locator(".toggle .revert")).toHaveCount(0);
    expect(revert.x + revert.width).toBeLessThanOrEqual(box.x);
  });

  test("accent paint is opt-in on the switch track", async({ page }) => {
    const neutral = row(page, "jolly-toggle", "modified").locator(".switch");
    const colored = row(page, "jolly-toggle", "colored+modified")
      .locator(".switch");

    expect(await styleOf(neutral, "background-color"))
      .not.toBe(await styleOf(colored, "background-color"));
  });
});
