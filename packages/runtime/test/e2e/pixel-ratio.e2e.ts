// Import Third-party Dependencies
import type { Page } from "@playwright/test";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import { bootRuntime } from "./support/runtime.ts";

test.describe("Runtime pixel ratio", () => {
  test.use({ deviceScaleFactor: 3 });

  test("load caps the device pixel ratio at 2 on desktop", async({ page }) => {
    await bootRuntime(page, {
      load: {
        skipLoadingScreen: true
      }
    });

    expect(await readPixelRatio(page)).toBe(2);
  });

  test("load keeps an explicit renderer pixel ratio", async({ page }) => {
    await bootRuntime(page, {
      runtime: {
        renderer: {
          output: {
            pixelRatio: 1
          }
        }
      },
      load: {
        skipLoadingScreen: true
      }
    });

    expect(await readPixelRatio(page)).toBe(1);
  });
});

function readPixelRatio(
  page: Page
): Promise<number> {
  return page.evaluate(
    () => window.runtimeE2E.runtime.renderer.source.getPixelRatio()
  );
}
