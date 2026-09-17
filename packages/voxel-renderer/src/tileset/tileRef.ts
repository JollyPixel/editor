// Import Internal Dependencies
import type {
  ResolvedTileRef,
  TileBounds,
  TileRef
} from "./types.ts";

// CONSTANTS
export const WHOLE_TILE_BOUNDS: Readonly<TileBounds> = Object.freeze({
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

export interface TileRescale {
  tilesetId: string;
  from: number;
  to: number;
}

/**
 * Expands a tuple reference and fills in a missing tileset ID.
 */
export function resolveTileRef(
  ref: TileRef,
  defaultTilesetId?: string
): ResolvedTileRef {
  if (Array.isArray(ref)) {
    return {
      col: ref[0],
      row: ref[1],
      tilesetId: defaultTilesetId
    };
  }

  if (ref.tilesetId || !defaultTilesetId) {
    return { ...ref };
  }

  return {
    ...ref,
    tilesetId: defaultTilesetId
  };
}

export function tileRectOf(
  ref: ResolvedTileRef,
  tileSize: number,
  bounds: TileBounds = WHOLE_TILE_BOUNDS
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
  bounds: TileBounds = WHOLE_TILE_BOUNDS
): ResolvedTileRef {
  const size = template.size ?? tileSize;

  return {
    ...template,
    col: (rect.x - (bounds.u0 * size)) / tileSize,
    row: (rect.y - ((1 - bounds.v1) * size)) / tileSize
  };
}

export function rescaleTileRef(
  ref: ResolvedTileRef,
  rescale: TileRescale
): ResolvedTileRef {
  if (ref.tilesetId !== rescale.tilesetId) {
    return ref;
  }

  const ratio = rescale.from / rescale.to;

  return {
    ...ref,
    col: ref.col * ratio,
    row: ref.row * ratio,
    size: ref.size ?? rescale.from
  };
}
