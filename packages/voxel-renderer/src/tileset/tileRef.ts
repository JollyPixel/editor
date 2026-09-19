// Import Internal Dependencies
import type {
  ResolvedTileRef,
  TileBounds,
  TileRef,
  TileRotation,
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
  span: Readonly<TileSpan> = UNIT_TILE_SPAN,
  rotation: TileRotation = 0
): Pick<TileRect, "width" | "height"> {
  const width = Math.max(1, Math.round(size * span.u));
  const height = Math.max(1, Math.round(size * span.v));

  return rotation % 2 === 0 ?
    { width, height } :
    { width: height, height: width };
}

export function rotateTileUv(
  u: number,
  v: number,
  rotation: TileRotation = 0
): [number, number] {
  switch (rotation) {
    case 1:
      return [v, 1 - u];
    case 2:
      return [1 - u, 1 - v];
    case 3:
      return [1 - v, u];
    default:
      return [u, v];
  }
}

export function rotateTileBounds(
  bounds: Readonly<TileBounds>,
  rotation: TileRotation = 0
): TileBounds {
  const [au, av] = rotateTileUv(bounds.u0, bounds.v0, rotation);
  const [bu, bv] = rotateTileUv(bounds.u1, bounds.v1, rotation);

  return {
    u0: Math.min(au, bu),
    v0: Math.min(av, bv),
    u1: Math.max(au, bu),
    v1: Math.max(av, bv)
  };
}

export function tileRectOf(
  ref: ResolvedTileRef,
  tileSize: number,
  bounds: TileBounds = WHOLE_TILE_BOUNDS,
  span: Readonly<TileSpan> = UNIT_TILE_SPAN
): TileRect {
  const rotation = ref.rotation ?? 0;
  const { width, height } = tileFootprint(ref.size ?? tileSize, span, rotation);
  const local = rotateTileBounds(bounds, rotation);

  return {
    x: (ref.col * tileSize) + (local.u0 * width),
    y: (ref.row * tileSize) + ((1 - local.v1) * height),
    width: (local.u1 - local.u0) * width,
    height: (local.v1 - local.v0) * height
  };
}

export function tileRefFromRect(
  rect: Pick<TileRect, "x" | "y">,
  template: ResolvedTileRef,
  tileSize: number,
  bounds: TileBounds = WHOLE_TILE_BOUNDS,
  span: Readonly<TileSpan> = UNIT_TILE_SPAN
): ResolvedTileRef {
  const rotation = template.rotation ?? 0;
  const { width, height } = tileFootprint(template.size ?? tileSize, span, rotation);
  const local = rotateTileBounds(bounds, rotation);

  return {
    ...template,
    col: (rect.x - (local.u0 * width)) / tileSize,
    row: (rect.y - ((1 - local.v1) * height)) / tileSize
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
