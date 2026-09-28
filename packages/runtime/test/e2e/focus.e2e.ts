// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import {
  bootRuntime,
  gameCanvas
} from "./support/runtime.ts";

// CONSTANTS
const kOutsideCanvas = {
  x: 700,
  y: 150
};

test.describe("Runtime focus", () => {
  test("a click anywhere on the page focuses the canvas", async({ page }) => {
    await bootRuntime(page, {
      load: {
        skipLoadingScreen: true
      }
    });
    const canvas = gameCanvas(page);
    await expect(canvas).toBeFocused();

    await canvas.blur();
    await expect(canvas).not.toBeFocused();

    await page.mouse.click(kOutsideCanvas.x, kOutsideCanvas.y);
    await expect(canvas).toBeFocused();
  });

  test("the focus hint shows only while the canvas is blurred", async({ page }) => {
    await bootRuntime(page, {
      runtime: {
        focusCanvas: false,
        focusHint: true
      },
      load: {
        skipLoadingScreen: true
      }
    });
    const canvas = gameCanvas(page);
    const hint = page.locator("[data-runtime-overlay]").getByText("Click to focus");
    await expect(hint).toBeHidden();

    await page.mouse.click(kOutsideCanvas.x, kOutsideCanvas.y);
    await expect(canvas).not.toBeFocused();
    await expect(hint).toBeVisible();

    await canvas.click();
    await expect(canvas).toBeFocused();
    await expect(hint).toBeHidden();
  });
});
