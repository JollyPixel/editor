// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";
import type { PixelDrawPanel } from "../../src/index.ts";
import {
  hoverTexturePixel,
  setMode
} from "./utils.ts";

test("Ctrl+A selects the full texture only when the canvas owns the key", async({ panel, page }) => {
  function selection() {
    return panel.evaluate(
      (element: PixelDrawPanel) => element.canvasManager!.selectionPresence?.toJSON() ?? null
    );
  }

  await setMode(panel, "paint");
  await hoverTexturePixel(panel, { x: 42, y: 42 });
  await page.keyboard.press("Control+a");
  await expect.poll(selection).toBeNull();

  await setMode(panel, "select");
  await page.mouse.move(0, 0);
  await page.keyboard.press("Control+a");
  await expect.poll(selection).toBeNull();

  await hoverTexturePixel(panel, { x: 42, y: 42 });
  await page.keyboard.press("Control+a");
  await expect.poll(selection).toEqual({
    phase: "selected",
    rect: { x: 0, y: 0, width: 80, height: 80 },
    mask: Array(80 * 80).fill(true)
  });

  await setMode(panel, "paint");
  await setMode(panel, "select");
  await page.keyboard.press("Control+k");
  const prompt = page.getByRole("combobox", { name: "Command" });
  await expect(prompt).toBeFocused();
  await prompt.fill("pixelart.keybinds.selectAll");
  await hoverTexturePixel(panel, { x: 42, y: 42 });
  await page.keyboard.press("Control+a");
  await expect.poll(() => prompt.evaluate(
    (element: HTMLInputElement) => [
      element.selectionStart,
      element.selectionEnd
    ]
  )).toEqual([0, "pixelart.keybinds.selectAll".length]);
  await expect.poll(selection).toBeNull();
});
