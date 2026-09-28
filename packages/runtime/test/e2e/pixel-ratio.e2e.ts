// Import Third-party Dependencies
import type { Page } from "@playwright/test";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import { bootRuntime } from "./support/runtime.ts";

test.describe("Runtime pixel ratio", () => {
  test.use({ deviceScaleFactor: 2 });

  test("load fits the pixel ratio to the device by default", async({ page }) => {
    await bootRuntime(page, {
      load: {
        skipLoadingScreen: true
      }
    });

    expect(await pixelRatioOf(page)).toBe(1);
  });

  test("load keeps an explicit renderer pixel ratio", async({ page }) => {
    await bootRuntime(page, {
      runtime: {
        renderer: {
          output: {
            pixelRatio: 2
          }
        }
      },
      load: {
        skipLoadingScreen: true
      }
    });

    expect(await pixelRatioOf(page)).toBe(2);
  });
});

function pixelRatioOf(
  page: Page
): Promise<number> {
  return page.evaluate(
    () => window.runtimeE2E.runtime.renderer.getSource().getPixelRatio()
  );
}
