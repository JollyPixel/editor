// Import Third-party Dependencies
import type { PanePlacement } from "@jolly-pixel/ui";
import type { UvAccess } from "@jolly-pixel/editor.pixel-art";

export type TexturePanel = "blocks" | "paint";

export class TextureHost {
  static resolve(
    blocks: PanePlacement | null,
    paint: PanePlacement | null,
    current: TexturePanel
  ): TextureHost {
    const grouped = blocks !== null &&
      paint !== null &&
      blocks.dock === paint.dock &&
      blocks.column === paint.column &&
      blocks.index === paint.index;
    if (!grouped) {
      return new TextureHost("paint", false);
    }
    if (blocks.active) {
      return new TextureHost("blocks", true);
    }

    return new TextureHost(paint.active ? "paint" : current, true);
  }

  readonly panel: TexturePanel;
  readonly grouped: boolean;

  constructor(
    panel: TexturePanel,
    grouped: boolean
  ) {
    this.panel = panel;
    this.grouped = grouped;
  }

  get uvAccess(): UvAccess {
    return this.panel === "paint" && this.grouped ? "view" : "edit";
  }
}
