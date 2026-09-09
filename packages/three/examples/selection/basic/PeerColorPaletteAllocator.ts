// Import Third-party Dependencies
import {
  ColorPalette,
  type ColorPaletteOptions
} from "@jolly-pixel/color";

// Import Internal Dependencies
import type { PeerColorAllocator } from "../../../src/index.ts";

export class PeerColorPaletteAllocator implements PeerColorAllocator {
  #palette: ColorPalette;
  #assigned = new Map<string, string>();

  constructor(
    options: ColorPaletteOptions = {}
  ) {
    this.#palette = new ColorPalette(options);
  }

  colorOf(
    peerId: string
  ): string {
    let color = this.#assigned.get(peerId);
    if (color === undefined) {
      color = this.#palette.next();
      this.#assigned.set(peerId, color);
    }

    return color;
  }

  release(
    peerId: string
  ): void {
    this.#assigned.delete(peerId);
  }
}
