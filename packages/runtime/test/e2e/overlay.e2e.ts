// Import Third-party Dependencies
import { boxOf } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import {
  bootRuntime,
  gameCanvas
} from "./support/runtime.ts";

test.describe("Runtime overlay", () => {
  test("the overlay layer follows the canvas box", async({ page }) => {
    await bootRuntime(page, {
      load: {
        skipLoadingScreen: true
      }
    });
    const canvas = gameCanvas(page);
    const overlay = page.locator("[data-runtime-overlay]");
    await expect.poll(() => boxOf(overlay)).toEqual(await boxOf(canvas));

    await page.locator("#viewport").evaluate((element) => {
      element.style.width = "320px";
    });
    await expect.poll(async() => (await boxOf(canvas)).width).toBe(320);
    await expect.poll(() => boxOf(overlay)).toEqual(await boxOf(canvas));

    await page.mouse.wheel(0, 100);
    await expect.poll(async() => (await boxOf(canvas)).y).toBe(-60);
    await expect.poll(() => boxOf(overlay)).toEqual(await boxOf(canvas));
  });

  test("the performance readout sits in the top-left corner", async({ page }) => {
    await bootRuntime(page, {
      runtime: {
        includePerformanceStats: true
      },
      load: {
        skipLoadingScreen: true
      }
    });
    const canvasBox = await boxOf(gameCanvas(page));
    const stats = page.locator("[data-runtime-overlay] jolly-stats");

    await expect.poll(async() => {
      const { x, y } = await boxOf(stats);

      return {
        x,
        y
      };
    }).toEqual({
      x: canvasBox.x + 8,
      y: canvasBox.y + 8
    });
  });
});
