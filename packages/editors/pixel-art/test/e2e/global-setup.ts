// Import Third-party Dependencies
import { chromium } from "@playwright/test";

// Import Internal Dependencies
import { BASE_URL, TEXTURE_SIZE } from "./constants.ts";
import { gotoDemo } from "./utils.ts";

export default async function globalSetup(): Promise<void> {
  const browser = await chromium.launch();
  // baseURL isn't picked up automatically outside the test fixture system
  // pass it explicitly so gotoDemo()'s relative page.goto("/") resolves.
  const page = await browser.newPage({
    baseURL: BASE_URL
  });

  try {
    await gotoDemo(page);

    await page.evaluate((size) => {
      const panel = document.querySelector("pixel-draw-panel") as unknown as {
        canvasManager: { texture: HTMLCanvasElement; };
      };
      const blank = document.createElement("canvas");
      blank.width = size.x;
      blank.height = size.y;
      panel.canvasManager.texture = blank;
    }, TEXTURE_SIZE);
  }
  finally {
    await browser.close();
  }
}
