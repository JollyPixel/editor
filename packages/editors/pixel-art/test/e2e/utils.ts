// Import Third-party Dependencies
import type { Page } from "@playwright/test";

import type { Mode } from "@jolly-pixel/pixel-draw.renderer";

export interface PixelRGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Open demo, then wait for real interactivity.
 * The loading overlay can still block pointer events after sync is ready.
 */
export async function gotoDemo(
  page: Page
): Promise<void> {
  await page.goto("/?empty=true");
  await page.locator("jolly-loading")
    .waitFor({ state: "attached", timeout: 2_000 })
    .catch(() => undefined);
  await page.locator("jolly-loading")
    .waitFor({ state: "detached", timeout: 15_000 });
  await page.waitForFunction(
    () => (window as unknown as { __pixelSyncReady?: boolean; }).__pixelSyncReady === true
  );
}

const kModeLabel: Record<Mode, string> = {
  move: "Move",
  paint: "Paint",
  fill: "Fill",
  select: "Select",
  uv: "UV"
};

/**
 * Switch mode via toolbar UI, not internal APIs.
 */
export async function setMode(
  page: Page,
  mode: Mode
): Promise<void> {
  await page.getByRole("button", {
    name: kModeLabel[mode],
    exact: true
  }).click();
}

/**
 * Convert texture pixel coords to screen coords for mouse actions.
 * Uses live camera/zoom and targets pixel center.
 */
export async function textureToScreenPoint(
  page: Page,
  tx: number,
  ty: number
): Promise<{ x: number; y: number; }> {
  return page.evaluate(({ tx, ty }) => {
    const panel = document.querySelector("pixel-draw-panel") as unknown as {
      canvasManager: {
        canvas(): HTMLCanvasElement;
        viewport: {
          camera: { x: number; y: number; };
          zoom: { value: number; };
        };
      };
    };
    const canvasManager = panel.canvasManager;
    const bounds = canvasManager.canvas().getBoundingClientRect();
    const { camera, zoom } = canvasManager.viewport;

    return {
      x: bounds.left + camera.x + ((tx + 0.5) * zoom.value),
      y: bounds.top + camera.y + ((ty + 0.5) * zoom.value)
    };
  }, { tx, ty });
}

/**
 * Read one pixel from the source texture canvas.
 * Ignores viewport pan/zoom.
 */
export async function readPixel(
  page: Page,
  x: number,
  y: number
): Promise<PixelRGBA> {
  return page.evaluate(({ x, y }) => {
    const panel = document.querySelector("pixel-draw-panel") as unknown as {
      canvasManager: { textureCanvas(): HTMLCanvasElement; };
    };
    const canvas = panel.canvasManager.textureCanvas();
    const ctx = canvas.getContext("2d")!;
    const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data;

    return { r, g, b, a };
  }, { x, y });
}

/**
 * Draw a stroke across texture points.
 * Extra mouse steps prevent gaps between far-apart points.
 */
export async function dragStroke(
  page: Page,
  points: { x: number; y: number; }[]
): Promise<void> {
  const screenPoints = await Promise.all(
    points.map((p) => textureToScreenPoint(page, p.x, p.y))
  );

  await page.mouse.move(screenPoints[0].x, screenPoints[0].y);
  await page.mouse.down();
  for (let i = 1; i < points.length; i++) {
    const distance = Math.max(
      Math.abs(points[i].x - points[i - 1].x),
      Math.abs(points[i].y - points[i - 1].y)
    );
    await page.mouse.move(screenPoints[i].x, screenPoints[i].y, {
      steps: Math.max(1, distance * 4)
    });
  }
  await page.mouse.up();
}

/**
 * Click one texture pixel, no drag.
 * Hover first so keyboard shortcuts still work right after.
 */
export async function clickTexturePixel(
  page: Page,
  x: number,
  y: number
): Promise<void> {
  const point = await textureToScreenPoint(page, x, y);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.up();
}
