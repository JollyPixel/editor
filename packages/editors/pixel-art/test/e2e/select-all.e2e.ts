// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";
import type { PixelDrawPanel } from "../../src/index.ts";

test("Ctrl+A selects the full texture only when the canvas owns the key", async({
  panel,
  page,
  commands
}) => {
  function selection() {
    return panel.root.evaluate(
      (element: PixelDrawPanel) => element.canvasManager!.selectionPresence?.toJSON() ?? null
    );
  }

  await panel.modes.select("paint");
  await panel.canvas.hover({ x: 42, y: 42 });
  await page.keyboard.press("Control+a");
  await expect.poll(selection).toBeNull();

  await panel.modes.select("select");
  await page.mouse.move(0, 0);
  await page.keyboard.press("Control+a");
  await expect.poll(selection).toBeNull();

  await panel.canvas.hover({ x: 42, y: 42 });
  await page.keyboard.press("Control+a");
  await expect.poll(selection).toEqual({
    phase: "selected",
    rect: { x: 0, y: 0, width: 80, height: 80 },
    mask: Array(80 * 80).fill(true)
  });

  await panel.modes.select("paint");
  await panel.modes.select("select");
  await commands.open();
  await commands.prompt.fill("pixelart.keybinds.selectAll");
  await panel.canvas.hover({ x: 42, y: 42 });
  await page.keyboard.press("Control+a");
  await expect.poll(() => commands.prompt.evaluate(
    (element: HTMLInputElement) => [
      element.selectionStart,
      element.selectionEnd
    ]
  )).toEqual([0, "pixelart.keybinds.selectAll".length]);
  await expect.poll(selection).toBeNull();
});
