// Import Third-party Dependencies
import { waitForEditor } from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";
import {
  BLACK,
  CLEAR,
  clickTexturePixel,
  readPixels,
  setMode
} from "./utils.ts";

test("an undo rebound from the console still works after a reload", async({ panel, page }) => {
  const prompt = page.getByRole("combobox", { name: "Command" });
  await page.keyboard.press("Control+k");
  await expect(prompt).toBeFocused();
  await prompt.fill("keybind.undo \"Mod+u\"");
  await prompt.press("Enter");
  await expect(page.getByRole("log", { name: "Console output" }))
    .toContainText("keybind.undo \"Mod+u\"");
  await page.keyboard.press("Escape");

  await page.reload();
  await waitForEditor(page);

  function pixel() {
    return readPixels(panel, [{ x: 65, y: 2 }]);
  }
  await setMode(panel, "paint");
  await clickTexturePixel(panel, { x: 65, y: 2 });
  await expect.poll(pixel).toEqual([BLACK]);

  await page.keyboard.press("Control+z");
  await expect.poll(pixel).toEqual([BLACK]);

  await page.keyboard.press("Control+u");
  await expect.poll(pixel).toEqual([CLEAR]);
});
