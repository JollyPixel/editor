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

export class TextureEditor {
  readonly host: Locator;
  readonly panel: Locator;
  readonly accessBadge: Locator;
  readonly addBlocksetButton: Locator;
  readonly #page: Page;

  constructor(
    page: Page
  ) {
    this.#page = page;
    this.host = page.locator("texture-editor");
    this.panel = this.host.locator("pixel-draw-panel");
    this.accessBadge = this.panel.locator("[part=access-badge]");
    this.addBlocksetButton = this.host.getByRole("button", { name: "Add blockset" });
  }

  blocksetTab(
    name: RegExp
  ): Locator {
    return this.panel.getByRole("tab", { name });
  }

  async editBlockset(
    label: string
  ): Promise<Locator> {
    await this.panel
      .getByRole("button", { name: `Edit ${label}` })
      .click();

    return dialog(this.#page, `Blockset "${label}"`);
  }

  async addBlankBlockset(
    name: string
  ): Promise<void> {
    await this.addBlocksetButton.click();
    const form = dialog(this.#page, "Add blockset");
    await buttonGroup(form, "Source")
      .getByRole("radio", { name: "New", exact: true })
      .click();
    await textField(form, "Name").fill(name);
    await form.getByRole("button", { name: "Create" }).click();
    await form.waitFor({ state: "hidden" });
  }

  async selectMode(
    label: string
  ): Promise<void> {
    await this.panel.getByRole("button", {
      name: label,
      exact: true
    }).click();
  }

  async clickTexel(
    point: TexturePoint
  ): Promise<void> {
    const screen = await this.panel.evaluate((element: PixelDrawPanel, target) => {
      const canvasManager = element.canvasManager!;

      return canvasManager.viewport.textureClientPosition(
        target,
        canvasManager.canvas().getBoundingClientRect()
      );
    }, point);
    const { mouse } = this.#page;
    await mouse.move(screen.x, screen.y);
    await mouse.down();
    await mouse.up();
  }

  blockTileCenter(
    blockId: number
  ): Promise<TexturePoint> {
    return this.#page.evaluate((id) => {
      const { view, blocksets } = window.voxelMapEditor!.workspace;
      const texture = view.document.blocks.get(id)!.defaultTexture!;
      const tileSize = blocksets.tileSizeFor(texture.blocksetId ?? "");
      if (tileSize === undefined) {
        throw new Error(`Block ${id} has no loaded blockset.`);
      }

      return {
        x: (texture.col * tileSize) + Math.floor(tileSize / 2),
        y: (texture.row * tileSize) + Math.floor(tileSize / 2)
      };
    }, blockId);
  }

  pixelAlpha(
    point: TexturePoint
  ): Promise<number> {
    return this.panel.evaluate((element: PixelDrawPanel, target) => {
      const { buffer } = element.canvasManager!.document;

      return buffer.samplePixel(target.x, target.y)[3];
    }, point);
  }
}
