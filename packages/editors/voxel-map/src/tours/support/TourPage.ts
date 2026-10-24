// Import Third-party Dependencies
import { TargetPath } from "@jolly-pixel/lantern";
import type { PixelDrawPanel } from "@jolly-pixel/editor.pixel-art";

// Import Internal Dependencies
import type { VoxelMapEditing } from "../../editing/VoxelMapEditing.ts";
import type { BlocksPanel } from "../../shell/panels/BlocksPanel.ts";

export class TourPage {
  readonly page: Document;

  constructor(
    page: Document
  ) {
    this.page = page;
  }

  get editing(): VoxelMapEditing | null {
    return this.page.querySelector<BlocksPanel>("blocks-panel")?.editing ?? null;
  }

  get texturePanel(): PixelDrawPanel | null {
    return this.page
      .querySelector("texture-editor")
      ?.shadowRoot
      ?.querySelector("pixel-draw-panel") ?? null;
  }

  finds(
    selectors: readonly string[]
  ): boolean {
    return new TargetPath(selectors).resolve(this.page) !== null;
  }
}
