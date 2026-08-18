// Import Third-party Dependencies
import {
  test,
  type Page
} from "@playwright/test";
import type { Mode } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { testRoomId, TEXTURE_SIZE } from "./constants.ts";
import type { PixelDrawPanel } from "../../src/index.ts";

export interface PixelRGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface GotoDemoOptions {
  /**
   * Boots the Three.js/WebGPU 3D preview runtime (camera, orbit controls,
   * UV region meshes). Its render loop runs continuously and competes with
   * every dispatched pointer event for the main thread, so it stays off
   * unless a test actually asserts on the 3D preview (see uv.e2e.ts).
   * @default false
   */
  runtime?: boolean;
}

/**
 * Open the demo and wait for interactivity.
 */
export async function gotoDemo(
  page: Page,
  room: string = testRoomId(test.info().parallelIndex),
  options: GotoDemoOptions = {}
): Promise<void> {
  const { runtime = false } = options;

  // The demo prompts for a username via a jolly-pixel/ui <jolly-dialog>,
  // which (unlike window.prompt) never auto-dismisses in a headless
  // browser, so it would hang __pixelSyncReady forever. Seed the session
  // storage key it checks before any script on the page runs.
  await page.addInitScript(() => {
    sessionStorage.setItem("pixel-draw-demo:username", "E2E");
  });

  const runtimeParam = runtime ? "" : "&runtime=off";
  await page.goto(`/?empty=true&room=${encodeURIComponent(room)}${runtimeParam}`);

  await page.waitForFunction(
    () => (window as unknown as { __pixelSyncReady?: boolean; }).__pixelSyncReady === true
  );

  // Each worker reuses one sync room across every test file (see
  // testRoomId()), with no per-test reset: a previous test's fire-and-forget
  // network op (e.g. a texture replace) can still be in flight when this
  // page joins the same room and lands after this test starts painting,
  // silently overwriting it. Blanking here mirrors global-setup.ts's
  // once-per-run reset, giving every test its own settled starting state.
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

const kModeLabel: Record<Mode, string> = {
  move: "Move",
  paint: "Paint",
  fill: "Fill",
  select: "Select",
  uv: "UV"
};

/**
 * Switch mode via the toolbar UI.
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
 * Convert texture pixels to screen coordinates.
 */
export async function textureToScreenPoint(
  page: Page,
  tx: number,
  ty: number
): Promise<{ x: number; y: number; }> {
  return page.evaluate(({ tx, ty }) => {
    const panel = document.querySelector<PixelDrawPanel>("pixel-draw-panel");
    const canvasManager = panel!.canvasManager!;
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
 */
export async function readPixel(
  page: Page,
  x: number,
  y: number
): Promise<PixelRGBA> {
  return page.evaluate(({ x, y }) => {
    const panel = document.querySelector<PixelDrawPanel>("pixel-draw-panel");
    const canvas = panel!.canvasManager!.textureCanvas();
    const ctx = canvas.getContext("2d")!;
    const [r, g, b, a] = ctx.getImageData(
      x,
      y,
      1,
      1
    ).data;

    return {
      r, g, b, a
    };
  }, { x, y });
}

/**
 * Read one visible pixel from the composited renderer canvas.
 */
export async function readRenderedPixel(
  page: Page,
  x: number,
  y: number
): Promise<PixelRGBA> {
  return page.evaluate(({ x, y }) => {
    const panel = document.querySelector<PixelDrawPanel>("pixel-draw-panel");
    const canvasManager = panel!.canvasManager!;
    const canvas = canvasManager.canvas();
    const bounds = canvas.getBoundingClientRect();

    const { camera, zoom } = canvasManager.viewport;
    const scaleX = canvas.width / bounds.width;
    const scaleY = canvas.height / bounds.height;
    const canvasX = Math.floor(
      (camera.x + ((x + 0.5) * zoom.value)) * scaleX
    );
    const canvasY = Math.floor(
      (camera.y + ((y + 0.5) * zoom.value)) * scaleY
    );
    const context = canvas.getContext("2d")!;
    const [r, g, b, a] = context.getImageData(
      canvasX,
      canvasY,
      1,
      1
    ).data;

    return {
      r,
      g,
      b,
      a
    };
  }, { x, y });
}

type MouseButton =
  | "left"
  | "right"
  | "middle";

/**
 * Draw a stroke across texture points.
 */
export async function dragStroke(
  page: Page,
  points: { x: number; y: number; }[],
  button: MouseButton = "left"
): Promise<void> {
  const screenPoints = await Promise.all(
    points.map((p) => textureToScreenPoint(page, p.x, p.y))
  );

  await page.mouse.move(
    screenPoints[0].x,
    screenPoints[0].y
  );
  await page.mouse.down({
    button
  });
  for (let i = 1; i < points.length; i++) {
    const distance = Math.max(
      Math.abs(points[i].x - points[i - 1].x),
      Math.abs(points[i].y - points[i - 1].y)
    );
    await page.mouse.move(
      screenPoints[i].x,
      screenPoints[i].y,
      {
        steps: Math.max(1, distance * 4)
      }
    );
  }
  await page.mouse.up({
    button
  });
}

/**
 * Click one texture pixel without dragging.
 */
export async function clickTexturePixel(
  page: Page,
  x: number,
  y: number,
  button: MouseButton = "left"
): Promise<void> {
  const point = await textureToScreenPoint(
    page,
    x,
    y
  );

  await page.mouse.move(
    point.x,
    point.y
  );
  await page.mouse.down({
    button
  });
  await page.mouse.up({
    button
  });
}

/**
 * Set the brush's primary or secondary color directly, bypassing the
 * swatch UI (for tests that only need a known color as a starting point).
 */
export async function setBrushColor(
  page: Page,
  slot: "primary" | "secondary",
  hex: string,
  opacity = 1
): Promise<void> {
  await page.evaluate((options) => {
    const {
      slot: colorSlot,
      hex: color,
      opacity: alpha
    } = options;

    const panel = document.querySelector<PixelDrawPanel>(
      "pixel-draw-panel"
    );
    panel!.canvasManager!.brush[colorSlot].set(
      color,
      alpha
    );
  }, { slot, hex, opacity });
}
