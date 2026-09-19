// Import Third-party Dependencies
import {
  test as base,
  type Locator,
  type Page
} from "@playwright/test";

// Import Internal Dependencies
import {
  testAssetId,
  RUNTIME_MAX_FPS
} from "./constants.ts";
import { TEXTURE_SIZE } from "../../examples/scripts/config.ts";
import type { PixelArtDemo } from "../../examples/scripts/boot/PixelArtDemo.ts";
import type {
  PixelDrawPanel,
  TextureImportPolicy
} from "../../src/index.ts";

export { expect } from "@playwright/test";

export interface DemoOptions {
  runtime?: boolean;
  maxFps?: number;
  importPolicy?: TextureImportPolicy;
  addDelay?: number;
}

export async function openDemo(
  page: Page,
  options: DemoOptions = {}
): Promise<Locator> {
  const {
    runtime = false,
    maxFps = RUNTIME_MAX_FPS,
    importPolicy = "replace",
    addDelay = 0
  } = options;

  await page.addInitScript(() => {
    sessionStorage.setItem("jolly-pixel:username", "E2E");
  });

  const query = new URLSearchParams({
    empty: "true",
    target: testAssetId(base.info().parallelIndex),
    "import-policy": importPolicy
  });
  if (runtime) {
    query.set("max-fps", String(maxFps));
  }
  else {
    query.set("runtime", "off");
  }
  if (addDelay > 0) {
    query.set("add-delay", String(addDelay));
  }
  await page.goto(`/?${query}`);
  await waitForDemo(page);

  return page.locator("pixel-draw-panel");
}

export async function waitForDemo(
  page: Page
): Promise<void> {
  await page.waitForFunction(() => window.pixelArtDemo !== undefined);
}

export async function resetCanvas(
  panel: Locator
): Promise<void> {
  await panel.evaluate((element: PixelDrawPanel, size) => {
    const canvas = element.canvasManager!;
    const blank = document.createElement("canvas");
    blank.width = size.x;
    blank.height = size.y;
    canvas.texture = blank;
    canvas.uv.clear();
    canvas.document.history.clear();
  }, TEXTURE_SIZE);
}

export const test = base.extend<{
  demo: DemoOptions;
  panel: Locator;
}>({
  demo: [{}, { option: true }],
  panel: [
    async({ page, demo }, use) => {
      const panel = await openDemo(page, demo);
      await resetCanvas(panel);
      await use(panel);
    },
    { auto: true }
  ]
});

declare global {
  interface Window {
    pixelArtDemo?: PixelArtDemo;
  }
}
