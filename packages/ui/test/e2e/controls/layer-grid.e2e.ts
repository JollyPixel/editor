// Import Third-party Dependencies
import {
  centerOf,
  dragTo,
  hold
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  test,
  expect,
  type Locator
} from "../fixtures.ts";
import { fieldRow as row } from "../support/gallery.ts";
import {
  fieldChanges,
  recordFieldChanges
} from "../support/events.ts";

// CONSTANTS
const kInitialMask = 0b1000_0000_0101;

function cell(
  grid: Locator,
  name: string,
  role: "checkbox" | "radio" = "checkbox"
): Locator {
  return grid.getByRole(role, {
    name,
    exact: true
  });
}

test.describe("controls: layer grid", () => {
  test.use({
    example: "controls/layer-grid"
  });

  test("a click toggles one bit and a drag paints the pressed state", async({ page }) => {
    await recordFieldChanges(page);
    const grid = row(page, "jolly-layer-grid", "default");

    await cell(grid, "2: Player").click();
    await dragTo(page, cell(grid, "6"), await centerOf(cell(grid, "8")));

    for (const name of ["2: Player", "6", "7", "8"]) {
      await expect(cell(grid, name)).toHaveAttribute("aria-checked", "true");
    }
    await expect.poll(() => fieldChanges(page)).toEqual([
      kInitialMask | 0b10,
      kInitialMask | 0b1110_0010
    ]);
  });

  test("Escape mid-drag restores the mask and commits nothing", async({ page }) => {
    await recordFieldChanges(page);
    const grid = row(page, "jolly-layer-grid", "default");

    await hold(
      page,
      await centerOf(cell(grid, "4")),
      await centerOf(cell(grid, "5"))
    );
    await expect(cell(grid, "5")).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Escape");
    await page.mouse.up();

    await expect(cell(grid, "4")).toHaveAttribute("aria-checked", "false");
    await expect(cell(grid, "5")).toHaveAttribute("aria-checked", "false");
    expect(await fieldChanges(page)).toEqual([]);
  });

  test("is one tab stop whose arrows cross blocks and Space toggles", async({ page }) => {
    await recordFieldChanges(page);
    const grid = row(page, "jolly-layer-grid", "default");
    const stop = grid.locator('.cell[tabindex="0"]');
    await expect(stop).toHaveCount(1);

    await stop.focus();
    for (let step = 0; step < 5; step++) {
      await page.keyboard.press("ArrowRight");
    }
    await expect(cell(grid, "11: Effects")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space");

    await expect(cell(grid, "16")).toBeFocused();
    await expect(stop).toHaveCount(1);
    await expect.poll(() => fieldChanges(page)).toEqual([
      kInitialMask | (2 ** 15)
    ]);
  });
});

test.describe("controls: layer grid index mode", () => {
  test.use({
    example: "controls/layer-grid",
    exampleOptions: {
      options: {
        index: true
      }
    }
  });

  test("clicks, drags and arrows each commit one index", async({ page }) => {
    await recordFieldChanges(page);
    const grid = row(page, "jolly-layer-grid", "default");
    await cell(grid, "8", "radio").click();
    await dragTo(
      page,
      cell(grid, "1: Default", "radio"),
      await centerOf(cell(grid, "10", "radio"))
    );
    await page.keyboard.press("ArrowLeft");

    await expect(cell(grid, "9", "radio"))
      .toHaveAttribute("aria-checked", "true");
    await expect(grid.locator('[aria-checked="true"]')).toHaveCount(1);
    await expect.poll(() => fieldChanges(page)).toEqual([7, 9, 8]);
  });
});
