// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";
import type { PixelDrawPanel } from "@jolly-pixel/editor.pixel-art";
import {
  buttonGroup,
  dialog,
  textField
} from "@jolly-pixel/e2e";

export interface TexturePoint {
  x: number;
  y: number;
}

export function blockTileCenter(
  page: Page,
  blockId: number
): Promise<TexturePoint> {
  return page.evaluate((id) => {
    const { engine, linkedTilesets } = window.voxelMapEditor!.workspace;
    const texture = engine.blockRegistry.get(id)!.defaultTexture!;
    const tileSize = linkedTilesets.tileSizeOf(texture.tilesetId ?? "");
    if (tileSize === undefined) {
      throw new Error(`Block ${id} has no loaded tileset.`);
    }

    return {
      x: (texture.col * tileSize) + Math.floor(tileSize / 2),
      y: (texture.row * tileSize) + Math.floor(tileSize / 2)
    };
  }, blockId);
}

export async function createBlankTileset(
  page: Page,
  name: string
): Promise<void> {
  const form = dialog(page, "Add tileset");
  await buttonGroup(form, "Source")
    .getByRole("radio", { name: "New", exact: true })
    .click();
  await textField(form, "Name").fill(name);
  await form.getByRole("button", { name: "Create" }).click();
  await form.waitFor({ state: "hidden" });
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
