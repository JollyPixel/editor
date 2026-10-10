// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";
import {
  BLACK,
  CLEAR
} from "./support/canvas.ts";

test.describe("undo and redo", () => {
  test.beforeEach(async({ panel }) => {
    await panel.modes.select("paint");
  });

  test("the toolbar buttons revert and reapply a stroke", async({ panel }) => {
    const { undoButton, redoButton } = panel;
    function pixel() {
      return panel.canvas.pixels([{ x: 65, y: 2 }]);
    }
    await expect(undoButton).toBeDisabled();
    await expect(redoButton).toBeDisabled();

    await panel.canvas.click({ x: 65, y: 2 });
    await expect.poll(pixel).toEqual([BLACK]);
    await expect(undoButton.locator(".rail-count")).toHaveText("1");

    await undoButton.click();
    await expect.poll(pixel).toEqual([CLEAR]);
    await expect(undoButton).toBeDisabled();
    await expect(undoButton.locator(".rail-count")).toHaveCount(0);
    await expect(redoButton.locator(".rail-count")).toHaveText("1");

    await redoButton.click();
    await expect.poll(pixel).toEqual([BLACK]);
    await expect(redoButton).toBeDisabled();
  });

  test("Ctrl+Z and Ctrl+Y undo and redo", async({ panel, page }) => {
    function pixel() {
      return panel.canvas.pixels([{ x: 67, y: 2 }]);
    }
    await panel.canvas.click({ x: 67, y: 2 });
    await expect.poll(pixel).toEqual([BLACK]);

    await page.keyboard.press("Control+z");
    await expect.poll(pixel).toEqual([CLEAR]);

    await page.keyboard.press("Control+y");
    await expect.poll(pixel).toEqual([BLACK]);
  });
});

test.describe("clear texture", () => {
  test("cancelling keeps the texture, and no UV option shows without regions", async({ panel, page }) => {
    await panel.canvas.seed([{ x: 69, y: 2, color: "#000000" }]);

    await panel.clearButton.click();
    const dialog = page.locator("clear-texture-dialog");
    await expect(dialog.getByText(
      "Clear the entire texture and make every pixel transparent?"
    )).toBeVisible();
    await expect(dialog.locator("jolly-checkbox")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();

    await expect(dialog.getByRole("alertdialog")).toBeHidden();
    await expect.poll(() => panel.canvas.pixels([{ x: 69, y: 2 }]))
      .toEqual([BLACK]);
  });

  test("UV slot pixels survive unless the option is checked", async({ panel, page }) => {
    await panel.uv.addRegion({ x: 72, y: 4, width: 4, height: 4 });
    await panel.canvas.seed([
      { x: 73, y: 5, color: "#000000" },
      { x: 69, y: 5, color: "#000000" }
    ]);
    const dialog = page.locator("clear-texture-dialog");
    function pixels() {
      return panel.canvas.pixels([
        { x: 69, y: 5 },
        { x: 73, y: 5 }
      ]);
    }

    await panel.clearButton.click();
    await expect(dialog.getByText(
      "Pixels inside UV slots are kept unless the option below is checked."
    )).toBeVisible();
    const keepUv = dialog.getByRole("checkbox");
    await expect(keepUv).not.toBeChecked();
    await dialog.getByRole("button", { name: "Clear", exact: true }).click();
    await expect(dialog.getByRole("alertdialog")).toBeHidden();
    await expect.poll(pixels).toEqual([CLEAR, BLACK]);

    await panel.clearButton.click();
    await keepUv.check();
    await dialog.getByRole("button", { name: "Clear", exact: true }).click();
    await expect.poll(pixels).toEqual([CLEAR, CLEAR]);
  });
});
