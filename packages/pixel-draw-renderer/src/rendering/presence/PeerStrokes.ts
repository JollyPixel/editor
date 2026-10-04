// Import Third-party Dependencies
import {
  formatRgba,
  fromRGBA8
} from "@jolly-pixel/color";

// Import Internal Dependencies
import { PeerLayer } from "./PeerLayer.ts";
import { CommittedPixels } from "./CommittedPixels.ts";
import type {
  PeerStrokePixel,
  Vec2
} from "../../types.ts";

export class PeerStrokes extends PeerLayer<PeerStrokePixel[]> {
  draw(
    ctx: CanvasRenderingContext2D
  ): void {
    for (const [, pixels] of this.states()) {
      for (const { x, y, color } of pixels) {
        ctx.fillStyle = formatRgba(fromRGBA8(color));
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  removeOverlapping(
    positions: Vec2[]
  ): void {
    const committed = new CommittedPixels(positions);
    if (!committed.isEmpty) {
      this.removeWhere((pixels) => pixels.some((pixel) => committed.has(pixel)));
    }
  }
}
