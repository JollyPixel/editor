// Import Internal Dependencies
import type {
  ResolvedTileRef,
  TileBounds,
  TileRef,
  TileSpan
} from "./types.ts";

// CONSTANTS
export const WHOLE_TILE_BOUNDS: Readonly<TileBounds> = Object.freeze({
  u0: 0,
  v0: 0,
  u1: 1,
  v1: 1
});
export const UNIT_TILE_SPAN: Readonly<TileSpan> = Object.freeze({
  u: 1,
  v: 1
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

export function tileFootprint(
  size: number,
  span: Readonly<TileSpan> = UNIT_TILE_SPAN
): Pick<TileRect, "width" | "height"> {
  return {
    width: Math.max(1, Math.round(size * span.u)),
    height: Math.max(1, Math.round(size * span.v))
  };
}

export function tileRectOf(
  ref: ResolvedTileRef,
  tileSize: number,
  bounds: TileBounds = WHOLE_TILE_BOUNDS,
  span: Readonly<TileSpan> = UNIT_TILE_SPAN
): TileRect {
  const { width, height } = tileFootprint(ref.size ?? tileSize, span);

  return {
    x: (ref.col * tileSize) + (bounds.u0 * width),
    y: (ref.row * tileSize) + ((1 - bounds.v1) * height),
    width: (bounds.u1 - bounds.u0) * width,
    height: (bounds.v1 - bounds.v0) * height
  };
}

export function tileRefFromRect(
  rect: Pick<TileRect, "x" | "y">,
  template: ResolvedTileRef,
  tileSize: number,
  bounds: TileBounds = WHOLE_TILE_BOUNDS,
  span: Readonly<TileSpan> = UNIT_TILE_SPAN
): ResolvedTileRef {
  const { width, height } = tileFootprint(template.size ?? tileSize, span);

  return {
    ...template,
    col: (rect.x - (bounds.u0 * width)) / tileSize,
    row: (rect.y - ((1 - bounds.v1) * height)) / tileSize
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
