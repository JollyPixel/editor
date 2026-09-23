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
    const { buffer } = element.canvasManager!.document;

    return buffer.samplePixel(target.x, target.y)[3];
  }, point);
}

export async function clickTexel(
  panel: Locator,
  point: TexturePoint
): Promise<void> {
  const screen = await panel.evaluate((element: PixelDrawPanel, target) => {
    const canvasManager = element.canvasManager!;

    return canvasManager.viewport.textureClientPosition(
      target,
      canvasManager.canvas().getBoundingClientRect()
    );
  }, point);
  const { mouse } = panel.page();
  await mouse.move(screen.x, screen.y);
  await mouse.down();
  await mouse.up();
}
