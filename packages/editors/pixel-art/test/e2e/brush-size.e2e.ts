// Import Third-party Dependencies
import { test, expect } from "@playwright/test";

// Import Internal Dependencies
import { gotoDemo, textureToScreenPoint } from "./utils.ts";

async function brushSize(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate(() => {
    const panel = document.querySelector("pixel-draw-panel") as unknown as {
      canvasManager: { brush: { size: number; }; };
    };

    return panel.canvasManager.brush.size;
  });
}

test.beforeEach(async({ page }) => {
  await gotoDemo(page);
});

test("Ctrl+wheel adjusts the brush size in Paint mode", async({ page }) => {
  const before = await brushSize(page);
  const anchor = await textureToScreenPoint(page, 40, 40);

  await page.mouse.move(anchor.x, anchor.y);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -100);
  await page.keyboard.up("Control");

  await expect.poll(() => brushSize(page)).toBe(before + 1);
  await expect(page.locator("pixel-draw-panel").getByText(`${before + 1}px`)).toBeVisible();
});
