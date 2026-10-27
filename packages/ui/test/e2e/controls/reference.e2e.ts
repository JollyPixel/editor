// Import Internal Dependencies
import {
  test,
  expect
} from "../fixtures.ts";
import { fieldRow as row } from "../support/gallery.ts";
import {
  recordEvents,
  recordedEvents
} from "../support/events.ts";

test.describe("reference", () => {
  test.use({
    example: "controls/reference"
  });

  test.beforeEach(async({ page }) => {
    await recordEvents(page, ["jolly-browse", "jolly-change", "jolly-open"]);
  });

  test("browsing and clearing write the next reference back", async({ page }) => {
    const field = row(page, "jolly-reference", "default");
    const box = field.getByRole("textbox", { name: "Voxel map" });

    await expect(box).toHaveText("forest-level");
    await field.getByRole("button", { name: "Browse" }).click();
    await expect(box).toHaveText("castle-keep");

    await box.focus();
    await page.keyboard.press("Enter");
    await expect(box).toHaveText("crystal-caves");

    await field.getByRole("button", { name: "Clear" }).click();
    await expect(box).toHaveText("<empty>");
    await expect(field.getByRole("button", { name: "Clear" })).toHaveCount(0);

    await page.keyboard.press("Enter");
    await expect(box).toHaveText("forest-level");
    await page.keyboard.press("Backspace");
    await expect(box).toHaveText("<empty>");

    expect(await recordedEvents(page)).toEqual([
      ["jolly-browse", "forest"],
      ["jolly-browse", "castle"],
      ["jolly-change", null],
      ["jolly-browse", null],
      ["jolly-change", null]
    ]);
  });

  test("double-click and Alt+Enter open a set reference, read-only included", async({ page }) => {
    const readonly = row(page, "jolly-reference", "readonly");
    const empty = row(page, "jolly-reference", "default");

    await readonly.getByRole("textbox").dblclick();
    await readonly.getByRole("textbox").press("Alt+Enter");
    await empty.getByRole("button", { name: "Clear" }).click();
    await empty.getByRole("textbox").dblclick();
    await empty.getByRole("textbox").press("Alt+Enter");

    expect(await recordedEvents(page)).toEqual([
      ["jolly-open", "forest"],
      ["jolly-open", "forest"],
      ["jolly-change", null]
    ]);
  });

  test("a field that cannot be edited neither browses nor clears", async({ page }) => {
    for (const state of ["readonly", "locked"]) {
      const field = row(page, "jolly-reference", state);

      await expect(field.getByRole("button", { name: "Browse" })).toBeDisabled();
      await expect(field.getByRole("button", { name: "Clear" })).toHaveCount(0);
      await field.getByRole("textbox").focus();
      await page.keyboard.press("Enter");
      await page.keyboard.press("Delete");
    }

    expect(await recordedEvents(page)).toEqual([]);
  });
});
