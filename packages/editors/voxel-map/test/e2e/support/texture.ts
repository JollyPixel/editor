// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";
import type { PixelDrawPanel } from "@jolly-pixel/editor.pixel-art";

export interface TexturePoint {
  x: number;
  y: number;
}

export function texturePanel(
  page: Page
): Locator {
  return page.locator("texture-editor pixel-draw-panel");
}

export async function setTextureMode(
  panel: Locator,
  label: string
): Promise<void> {
  await panel.getByRole("button", {
    name: label,
    exact: true
  }).click();
}

export function textureState(
  panel: Locator
) {
  return panel.evaluate((element: PixelDrawPanel) => {
    return {
      activeTextureId: element.activeTextureId,
      textureIds: element.textures.map((texture) => texture.id),
      selectedRegionId: element.canvasManager?.uv.selectedRegionId ?? null
    };
  });
}

export function pixelAlpha(
  panel: Locator,
  point: TexturePoint
): Promise<number> {
  return panel.evaluate((element: PixelDrawPanel, target) => {
    const texture = element.canvasManager!.textureCanvas();

    return texture.getContext("2d")!
      .getImageData(target.x, target.y, 1, 1)
      .data[3];
  }, point);
}

export async function clickTexel(
  panel: Locator,
  point: TexturePoint
): Promise<void> {
  const screen = await panel.evaluate((element: PixelDrawPanel, target) => {
    const canvasManager = element.canvasManager!;
    const bounds = canvasManager.canvas().getBoundingClientRect();
    const { camera, zoom } = canvasManager.viewport;

    return {
      x: bounds.left + camera.x + ((target.x + 0.5) * zoom.value),
      y: bounds.top + camera.y + ((target.y + 0.5) * zoom.value)
    };
  }, point);
  const { mouse } = panel.page();
  await mouse.move(screen.x, screen.y);
  await mouse.down();
  await mouse.up();
}
