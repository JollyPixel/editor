// Import Third-party Dependencies
import { chromium } from "@playwright/test";

// Import Internal Dependencies
import {
  BASE_URL,
  TEXTURE_SIZE,
  WORKER_COUNT,
  testRoomId
} from "./constants.ts";
import { gotoDemo } from "./utils.ts";
import type { PixelDrawPanel } from "../../src/index.ts";

/**
 * Runs once before every worker starts (not once per worker), so it must
 * blank every worker's room itself — there's no `test.info()` here to
 * resolve a single room the way `gotoDemo()` normally does.
 */
export default async function globalSetup(): Promise<void> {
  const browser = await chromium.launch();
  // Pass baseURL explicitly so relative navigation resolves.
  const page = await browser.newPage({
    baseURL: BASE_URL
  });

  try {
    for (let workerIndex = 0; workerIndex < WORKER_COUNT; workerIndex++) {
      await gotoDemo(page, testRoomId(workerIndex));

      await page.evaluate((size) => {
        const panel = document.querySelector<PixelDrawPanel>("pixel-draw-panel");
        const canvasManager = panel!.canvasManager!;
        const blank = document.createElement("canvas");
        blank.width = size.x;
        blank.height = size.y;
        canvasManager.texture = blank;
        canvasManager.uv.clear();
      }, TEXTURE_SIZE);
    }
  }
  finally {
    await browser.close();
  }
}
