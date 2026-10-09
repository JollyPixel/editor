// Import Third-party Dependencies
import {
  RectArea,
  UVRegion,
  type SelectionRect,
  type UVLayoutData,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// CONSTANTS
const kBlockUvSize = 16;
const kLayoutIdentity = {
  id: "layout",
  color: "#000"
};

export class BlockUvLayouts {
  static net(
    origin: Vec2 = { x: 0, y: 0 }
  ): UVLayoutData {
    const stacked = UVRegion.fromLayout({
      state: "stacked",
      rect: {
        x: origin.x,
        y: origin.y,
        width: kBlockUvSize,
        height: kBlockUvSize
      }
    }, kLayoutIdentity);

    return stacked.unfold().toLayout();
  }

  readonly #bounds: readonly SelectionRect[];

  constructor(
    layouts: Iterable<UVLayoutData>
  ) {
    this.#bounds = Array.from(layouts, boundsOf);
  }

  get extent(): Vec2 {
    const extent = {
      x: 0,
      y: 0
    };
    for (const bounds of this.#bounds) {
      extent.x = Math.max(extent.x, bounds.x + bounds.width);
      extent.y = Math.max(extent.y, bounds.y + bounds.height);
    }

    return extent;
  }

  nextNet(
    textureSize: Vec2
  ): UVLayoutData {
    return BlockUvLayouts.net(this.#freeOrigin(textureSize));
  }

  #freeOrigin(
    textureSize: Vec2
  ): Vec2 {
    const net = boundsOf(BlockUvLayouts.net());
    const taken = this.#bounds.map((bounds) => RectArea.from(bounds));
    const columns = Math.floor(textureSize.x / net.width);
    const rows = Math.floor(textureSize.y / net.height);

    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const cell = {
          x: column * net.width,
          y: row * net.height,
          width: net.width,
          height: net.height
        };
        if (!taken.some((area) => area.intersects(cell))) {
          return {
            x: cell.x,
            y: cell.y
          };
        }
      }
    }

    return {
      x: 0,
      y: 0
    };
  }
}

function boundsOf(
  layout: UVLayoutData
): SelectionRect {
  return UVRegion.fromLayout(layout, kLayoutIdentity).bounds;
}
