// Import Third-party Dependencies
import { TargetPath } from "@jolly-pixel/lantern";
import type { PixelDrawPanel } from "@jolly-pixel/editor.pixel-art";

// Import Internal Dependencies
import type { VoxelMapEditing } from "../../editing/VoxelMapEditing.ts";
import type { LayersPanel } from "../../shell/panels/LayersPanel.ts";

export class TourPage {
  readonly page: Document;

  constructor(
    page: Document
  ) {
    this.page = page;
  }

  get editing(): VoxelMapEditing | null {
    return this.page.querySelector<LayersPanel>("layers-panel")?.editing ?? null;
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
