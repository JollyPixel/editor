// Import Internal Dependencies
import type { ResolvedTileRef } from "./types.ts";
import type {
  ShapeTextureBounds
} from "../blocks/shape/shapeTextureLayout.ts";

// CONSTANTS
export const WHOLE_TILE_BOUNDS: Readonly<ShapeTextureBounds> = Object.freeze({
  u0: 0,
  v0: 0,
  u1: 1,
  v1: 1
});

export interface TileRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function tileRectOf(
  ref: ResolvedTileRef,
  tileSize: number,
  bounds: ShapeTextureBounds = WHOLE_TILE_BOUNDS
): TileRect {
  const size = ref.size ?? tileSize;

  return {
    x: (ref.col * tileSize) + (bounds.u0 * size),
    y: (ref.row * tileSize) + ((1 - bounds.v1) * size),
    width: (bounds.u1 - bounds.u0) * size,
    height: (bounds.v1 - bounds.v0) * size
  };
}

export function tileRefFromRect(
  rect: Pick<TileRect, "x" | "y">,
  template: ResolvedTileRef,
  tileSize: number,
  bounds: ShapeTextureBounds = WHOLE_TILE_BOUNDS
): ResolvedTileRef {
  const size = template.size ?? tileSize;

  return {
    ...template,
    col: (rect.x - (bounds.u0 * size)) / tileSize,
    row: (rect.y - ((1 - bounds.v1) * size)) / tileSize
  };
}
