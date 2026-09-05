// Import Third-party Dependencies
import { ColorPalette, type ColorPaletteOptions } from "@jolly-pixel/color";

// Import Internal Dependencies
import type { PeerColorAllocator } from "../../../src/index.ts";

/**
 * Round-robin `PeerColorAllocator` built on `ColorPalette`: a peer keeps its
 * assigned color until `release()`, instead of `PeerSelectionRegistry`'s own
 * default hash-based allocator (stateless, coordination-free, but not
 * collision-free once peer count nears the palette size).
 *
 * `next()` is a simple forever-advancing cursor, not a strict free-list -
 * this reduces collisions while the peer count stays under the palette size,
 * it does not guarantee a freed color is the next one reused. It's meant as
 * a demonstration of the injection point, not a production-grade allocator.
 *
 * Construct one instance and share it across every editor's
 * `PeerSelectionRegistry` in the same collaborative session to keep a peer's
 * color consistent workspace-wide; construct one per registry instead if
 * each editor should have its own independent coloring.
 */
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
