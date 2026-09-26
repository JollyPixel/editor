// Import Third-party Dependencies
import {
  UVRegion,
  type SelectionRect,
  type UVLayoutData,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// CONSTANTS
export const BLOCK_UV_SIZE = 16;
const kLayoutIdentity = {
  id: "layout",
  color: "#000"
};

/**
 * The default layout of a block: its six faces unfolded as a net whose
 * top-left corner is `origin`, each face BLOCK_UV_SIZE pixels square.
 */
export function createBlockUv(
  origin: Vec2 = { x: 0, y: 0 }
): UVLayoutData {
  const stacked = UVRegion.fromLayout({
    state: "stacked",
    rect: {
      x: origin.x,
      y: origin.y,
      width: BLOCK_UV_SIZE,
      height: BLOCK_UV_SIZE
    }
  }, kLayoutIdentity);

  return stacked.unfold().toLayout();
}

export function blockUvBounds(
  layout: UVLayoutData
): SelectionRect {
  return UVRegion.fromLayout(layout, kLayoutIdentity).bounds;
}

/**
 * The origin of the first cell, row by row within `textureSize`, where a
 * default block net overlaps none of `layouts`. Falls back to the texture
 * origin once every cell is taken.
 */
export function nextBlockUvOrigin(
  layouts: Iterable<UVLayoutData>,
  textureSize: Vec2
): Vec2 {
  const net = blockUvBounds(createBlockUv());
  const taken = [...layouts].map(blockUvBounds);
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
      if (!taken.some((rect) => overlaps(rect, cell))) {
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

function overlaps(
  a: SelectionRect,
  b: SelectionRect
): boolean {
  return a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height;
}
