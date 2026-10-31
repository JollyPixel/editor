// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";
import type { PixelDrawPanel } from "@jolly-pixel/editor.pixel-art";
import { measureBox } from "@jolly-pixel/e2e";

export interface TexturePoint {
  x: number;
  y: number;
}

export class TextureEditor {
  readonly #page: Page;
  readonly #panel: Locator;
  readonly #canvasHost: Locator;

  constructor(
    page: Page
  ) {
    this.#page = page;
    this.#panel = page.locator("texture-editor pixel-draw-panel");
    this.#canvasHost = this.#panel.locator("[part~='canvas-host']");
  }

  async pickModeOption(
    mode: string,
    option: string
  ): Promise<void> {
    await this.#page.mouse.move(0, 0);
    await this.#button(mode).hover();
    await this.#button(option).click();
  }

  async clickTexel(
    point: TexturePoint
  ): Promise<void> {
    const screen = await this.#panel.evaluate((element: PixelDrawPanel, target) => {
      const canvasManager = element.canvasManager!;

      return canvasManager.viewport.textureClientPosition(
        target,
        canvasManager.canvas().getBoundingClientRect()
      );
    }, point);
    const box = await measureBox(this.#canvasHost);
    await this.#canvasHost.click({
      position: {
        x: screen.x - box.x,
        y: screen.y - box.y
      }
    });
  }

  blockTileCenter(
    blockName: string
  ): Promise<TexturePoint> {
    return this.#page.evaluate((name) => {
      const { view, blocksets } = window.voxelMapEditor!.editing;
      const block = [...view.document.blocks.getAll()]
        .find((candidate) => candidate.name === name);
      const texture = block?.defaultTexture;
      const tileSize = blocksets.blocksetTileSize(texture?.blocksetId ?? "");
      if (texture === undefined || tileSize === undefined) {
        throw new Error(`Block "${name}" has no tile in a loaded blockset.`);
      }

      return {
        x: (texture.col * tileSize) + Math.floor(tileSize / 2),
        y: (texture.row * tileSize) + Math.floor(tileSize / 2)
      };
    }, blockName);
  }

  pixelAlpha(
    point: TexturePoint
  ): Promise<number> {
    return this.#panel.evaluate((element: PixelDrawPanel, target) => {
      const { buffer } = element.canvasManager!.document;

      return buffer.samplePixel(target.x, target.y)[3];
    }, point);
  }

  #button(
    name: string
  ): Locator {
    return this.#panel.getByRole("button", {
      name,
      exact: true
    });
  }
}
