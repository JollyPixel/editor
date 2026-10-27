// Import Internal Dependencies
import {
  test,
  expect
} from "../fixtures.ts";
import { fieldRow as row } from "../support/gallery.ts";
import {
  fieldChanges,
  fieldInputValues,
  recordFieldChanges,
  recordFieldInputs
} from "../support/events.ts";

test.describe("controls: select grid", () => {
  test.use({
    example: "controls/select-grid"
  });

  test.beforeEach(async({ page }) => {
    await recordFieldChanges(page);
    await recordFieldInputs(page);
  });

  test("opens on the selected tile, walks the grid by row and commits with Enter", async({ page }) => {
    const field = row(page, "jolly-select", "default");
    const listbox = field.getByRole("listbox", { name: "Tool" });

    await field.getByRole("button", {
      name: "Move",
      exact: true
    }).focus();
    await page.keyboard.press("ArrowDown");

    await expect(listbox).toBeVisible();
    await expect(listbox.getByRole("option", {
      name: "Move",
      exact: true
    })).toBeFocused();

    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    await expect(listbox.getByRole("option", {
      name: "Lock",
      exact: true
    })).toBeFocused();

    await page.keyboard.press("Enter");

    await expect(listbox).toBeHidden();
    await expect.poll(() => fieldChanges(page)).toEqual(["lock"]);
    await expect.poll(() => fieldInputValues(page)).toEqual(["add", "lock"]);
  });

  test("previews the hovered tile and puts the value back on Escape", async({ page }) => {
    const field = row(page, "jolly-select", "default");
    const listbox = field.getByRole("listbox", { name: "Tool" });

    await field.getByRole("button", {
      name: "Move",
      exact: true
    }).click();
    await listbox.getByRole("option", {
      name: "Search",
      exact: true
    }).hover();
    await expect(field.locator(".caption")).toHaveText("Search");

    await page.keyboard.press("Escape");

    await expect(listbox).toBeHidden();
    await expect.poll(() => fieldInputValues(page)).toEqual(["search", "move"]);
    await expect.poll(() => fieldChanges(page)).toEqual([]);
  });
});
