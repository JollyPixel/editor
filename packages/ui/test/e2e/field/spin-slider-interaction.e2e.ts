// Import Third-party Dependencies
import {
  boxOf,
  scrubBy
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  test,
  expect
} from "../fixtures.ts";
import { fieldRow as row } from "../support/gallery.ts";
import {
  fieldChanges as changes,
  recordFieldChanges as recordChanges
} from "../support/events.ts";

test.describe("spin slider", () => {
  test.use({
    example: "controls/spin-slider"
  });

  test.beforeEach(async({ page }) => {
    await recordChanges(page);
  });

  test("a drag over a quarter of the bar moves a quarter of the range and commits once", async({ page }) => {
    const field = row(page, "jolly-spin-slider", "default");
    const bar = await boxOf(field.locator(".bar"));

    await scrubBy(page, field.locator("input"), bar.width / 4);

    await expect.poll(() => changes(page)).toEqual([0.75]);
    await expect(field.locator("input")).not.toBeFocused();
  });

  test("a click without travel opens the value for typing", async({ page }) => {
    const input = row(page, "jolly-spin-slider", "default")
      .getByRole("spinbutton", { name: "Intensity" });

    await input.click();
    await expect(input).toBeFocused();
    await page.keyboard.type("0.3");
    await page.keyboard.press("Enter");

    await expect.poll(() => changes(page)).toEqual([0.3]);
  });

  test("pressing the bar jumps to that point", async({ page }) => {
    const bar = row(page, "jolly-spin-slider", "default").locator(".bar");
    const box = await boxOf(bar);

    await bar.click({
      position: {
        x: box.width * 0.2,
        y: box.height / 2
      }
    });

    await expect.poll(() => changes(page)).toEqual([0.2]);
  });
});
