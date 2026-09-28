// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import {
  bootRuntime,
  gameCanvas,
  isRunning,
  ticksOverFrames
} from "./support/runtime.ts";

test.describe("Runtime lifecycle", () => {
  test("load hands the canvas over from the loading screen", async({ page }) => {
    await bootRuntime(page, {
      load: {
        loadingDelay: 0
      }
    });

    await expect(page.locator("jolly-loading")).toHaveCount(0);
    await expect(gameCanvas(page)).toHaveCSS("opacity", "1");
    expect(await isRunning(page)).toBe(true);
  });

  test("frames advance only between start and stop", async({ page }) => {
    await bootRuntime(page, {
      load: {
        skipLoadingScreen: true
      }
    });
    await page.evaluate(() => window.runtimeE2E.runtime.frames(3));

    await page.evaluate(() => window.runtimeE2E.runtime.stop());
    expect(await isRunning(page)).toBe(false);
    expect(await ticksOverFrames(page, 5)).toBe(0);

    await page.evaluate(() => window.runtimeE2E.runtime.start());
    expect(await isRunning(page)).toBe(true);
    await page.evaluate(() => window.runtimeE2E.runtime.frames(3));
  });

  test("dispose removes the overlay layer and its readout", async({ page }) => {
    await bootRuntime(page, {
      runtime: {
        includePerformanceStats: true
      },
      load: {
        skipLoadingScreen: true
      }
    });
    const overlay = page.locator("[data-runtime-overlay]");
    await expect(overlay.locator("jolly-stats")).toHaveCount(1);

    await page.evaluate(() => window.runtimeE2E.runtime.dispose());

    await expect(overlay).toHaveCount(0);
    await expect(page.locator("jolly-stats")).toHaveCount(0);
  });
});
