// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";
import {
  BLACK,
  CLEAR
} from "./support/canvas.ts";

test("an undo rebound from the console still works after a reload", async({ panel, page, commands }) => {
  await commands.submit("pixelart.keybinds.undo \"Mod+u\"");
  await commands.close();

  await panel.reload();

  function pixel() {
    return panel.canvas.pixels([{ x: 65, y: 2 }]);
  }
  await panel.modes.select("paint");
  await panel.canvas.click({ x: 65, y: 2 });
  await expect.poll(pixel).toEqual([BLACK]);

  await page.keyboard.press("Control+z");
  await expect.poll(pixel).toEqual([BLACK]);

  await page.keyboard.press("Control+u");
  await expect.poll(pixel).toEqual([CLEAR]);
});
