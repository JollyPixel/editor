// Import Third-party Dependencies
import {
  test,
  expect,
  type Page
} from "@playwright/test";

// Import Internal Dependencies
import {
  gotoDemo,
  setMode,
  clickTexturePixel,
  readPixel
} from "./utils.ts";
import type { PixelDrawPanel } from "../../src/index.ts";

async function addUvRegion(
  page: Page,
  rect: { x: number; y: number; width: number; height: number; }
): Promise<void> {
  await page.evaluate((regionRect) => {
    const panel = document.querySelector<PixelDrawPanel>("pixel-draw-panel");
    panel!.canvasManager!.uv.restore({
      id: "clear-slot",
      color: "#00ffff",
      state: "stacked",
      rect: regionRect
    });
  }, rect);
}

test.beforeEach(async({ page }) => {
  await gotoDemo(page);
  await setMode(page, "paint");
});

test("Undo/redo buttons revert and reapply a stroke", async({ page }) => {
  const undoButton = page.getByRole("button", { name: "Undo" });
  const redoButton = page.getByRole("button", { name: "Redo" });

  await expect(undoButton).toBeDisabled();
  await expect(redoButton).toBeDisabled();

  await clickTexturePixel(page, 65, 2);
  await expect.poll(
    () => readPixel(page, 65, 2)
  ).toEqual({ r: 0, g: 0, b: 0, a: 255 });
  await expect(undoButton).toBeEnabled();

  await undoButton.click();
  await expect.poll(
    () => readPixel(page, 65, 2)
  ).toMatchObject({ a: 0 });
  await expect(redoButton).toBeEnabled();

  await redoButton.click();
  await expect.poll(
    () => readPixel(page, 65, 2)
  ).toEqual({ r: 0, g: 0, b: 0, a: 255 });
});

test("mod+z / mod+y keyboard shortcuts undo and redo", async({ page }) => {
  await clickTexturePixel(page, 67, 2);
  await expect.poll(
    () => readPixel(page, 67, 2)
  ).toEqual({ r: 0, g: 0, b: 0, a: 255 });

  await page.keyboard.press("Control+z");
  await expect.poll(
    () => readPixel(page, 67, 2)
  ).toMatchObject({ a: 0 });

  await page.keyboard.press("Control+y");
  await expect.poll(
    () => readPixel(page, 67, 2)
  ).toEqual({ r: 0, g: 0, b: 0, a: 255 });
});

test("Clear texture leaves the texture unchanged when cancelled", async({ page }) => {
  await clickTexturePixel(page, 69, 2);
  await expect.poll(
    () => readPixel(page, 69, 2)
  ).toEqual({ r: 0, g: 0, b: 0, a: 255 });

  await page.getByRole("button", { name: "Clear texture" }).click();
  const dialog = page.locator("jolly-dialog");
  await expect(dialog).toContainText("Clear texture");
  await expect(dialog).toContainText(
    "Clear the entire texture and make every pixel transparent?"
  );
  await expect.poll(
    () => readPixel(page, 69, 2)
  ).toEqual({ r: 0, g: 0, b: 0, a: 255 });

  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(
    () => readPixel(page, 69, 2)
  ).toEqual({ r: 0, g: 0, b: 0, a: 255 });
  await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled();
});

test("Clear texture replaces the texture after confirmation", async({ page }) => {
  await clickTexturePixel(page, 71, 2);
  await expect.poll(
    () => readPixel(page, 71, 2)
  ).toEqual({ r: 0, g: 0, b: 0, a: 255 });

  await page.getByRole("button", { name: "Clear texture" }).click();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect.poll(
    () => readPixel(page, 71, 2)
  ).toMatchObject({ a: 0 });
});

test("Clear texture hides the UV option when the texture has no regions", async({ page }) => {
  await page.getByRole("button", { name: "Clear texture" }).click();
  const dialog = page.locator("jolly-dialog");
  await expect(dialog).toContainText(
    "Clear the entire texture and make every pixel transparent?"
  );
  await expect(dialog.locator("jolly-checkbox")).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
});

test("Clear texture keeps UV slot pixels unless the option is checked", async({ page }) => {
  await addUvRegion(page, { x: 72, y: 4, width: 4, height: 4 });
  await clickTexturePixel(page, 73, 5);
  await clickTexturePixel(page, 69, 5);
  await expect.poll(
    () => readPixel(page, 69, 5)
  ).toEqual({ r: 0, g: 0, b: 0, a: 255 });

  await page.getByRole("button", { name: "Clear texture" }).click();
  const dialog = page.locator("jolly-dialog");
  await expect(dialog).toContainText(
    "Pixels inside UV slots are kept unless the option below is checked."
  );
  await expect(dialog.locator("jolly-checkbox input[type=checkbox]")).not.toBeChecked();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(
    () => readPixel(page, 69, 5)
  ).toMatchObject({ a: 0 });
  await expect.poll(
    () => readPixel(page, 73, 5)
  ).toEqual({ r: 0, g: 0, b: 0, a: 255 });

  await page.getByRole("button", { name: "Clear texture" }).click();
  await dialog.locator("jolly-checkbox input[type=checkbox]").check();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect.poll(
    () => readPixel(page, 73, 5)
  ).toMatchObject({ a: 0 });
});
