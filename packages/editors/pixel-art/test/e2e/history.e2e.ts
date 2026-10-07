// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";
import {
  BLACK,
  CLEAR,
  addUvRegion,
  clickTexturePixel,
  readPixels,
  seedTexture,
  setMode
} from "./utils.ts";

test.describe("undo and redo", () => {
  test.beforeEach(async({ panel }) => {
    await setMode(panel, "paint");
  });

  test("the toolbar buttons revert and reapply a stroke", async({ panel }) => {
    const undo = panel.getByRole("button", { name: "Undo" });
    const redo = panel.getByRole("button", { name: "Redo" });
    function pixel() {
      return readPixels(panel, [{ x: 65, y: 2 }]);
    }
    await expect(undo).toBeDisabled();
    await expect(redo).toBeDisabled();

    await clickTexturePixel(panel, { x: 65, y: 2 });
    await expect.poll(pixel).toEqual([BLACK]);
    await expect(undo.locator(".rail-count")).toHaveText("1");

    await undo.click();
    await expect.poll(pixel).toEqual([CLEAR]);
    await expect(undo).toBeDisabled();
    await expect(undo.locator(".rail-count")).toHaveCount(0);
    await expect(redo.locator(".rail-count")).toHaveText("1");

    await redo.click();
    await expect.poll(pixel).toEqual([BLACK]);
    await expect(redo).toBeDisabled();
  });

  test("Ctrl+Z and Ctrl+Y undo and redo", async({ panel, page }) => {
    function pixel() {
      return readPixels(panel, [{ x: 67, y: 2 }]);
    }
    await clickTexturePixel(panel, { x: 67, y: 2 });
    await expect.poll(pixel).toEqual([BLACK]);

    await page.keyboard.press("Control+z");
    await expect.poll(pixel).toEqual([CLEAR]);

    await page.keyboard.press("Control+y");
    await expect.poll(pixel).toEqual([BLACK]);
  });
});

test.describe("clear texture", () => {
  test("cancelling keeps the texture, and no UV option shows without regions", async({ panel, page }) => {
    await seedTexture(panel, [{ x: 69, y: 2, color: "#000000" }]);

    await panel.getByRole("button", { name: "Clear texture" }).click();
    const dialog = page.locator("clear-texture-dialog");
    await expect(dialog.getByText(
      "Clear the entire texture and make every pixel transparent?"
    )).toBeVisible();
    await expect(dialog.locator("jolly-checkbox")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();

    await expect(dialog.getByRole("alertdialog")).toBeHidden();
    await expect.poll(() => readPixels(panel, [{ x: 69, y: 2 }]))
      .toEqual([BLACK]);
  });

  test("UV slot pixels survive unless the option is checked", async({ panel, page }) => {
    await addUvRegion(panel, { x: 72, y: 4, width: 4, height: 4 });
    await seedTexture(panel, [
      { x: 73, y: 5, color: "#000000" },
      { x: 69, y: 5, color: "#000000" }
    ]);
    const dialog = page.locator("clear-texture-dialog");
    function pixels() {
      return readPixels(panel, [
        { x: 69, y: 5 },
        { x: 73, y: 5 }
      ]);
    }

    await panel.getByRole("button", { name: "Clear texture" }).click();
    await expect(dialog.getByText(
      "Pixels inside UV slots are kept unless the option below is checked."
    )).toBeVisible();
    const keepUv = dialog.getByRole("checkbox");
    await expect(keepUv).not.toBeChecked();
    await dialog.getByRole("button", { name: "Clear", exact: true }).click();
    await expect(dialog.getByRole("alertdialog")).toBeHidden();
    await expect.poll(pixels).toEqual([CLEAR, BLACK]);

    await panel.getByRole("button", { name: "Clear texture" }).click();
    await keepUv.check();
    await dialog.getByRole("button", { name: "Clear", exact: true }).click();
    await expect.poll(pixels).toEqual([CLEAR, CLEAR]);
  });
});
