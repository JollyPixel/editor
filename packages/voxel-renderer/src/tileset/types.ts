// Import Third-party Dependencies
import type * as THREE from "three";

export interface ResolvedTileRef {
  col: number;
  row: number;
  tilesetId?: string;
}

export type Coords = [col: number, row: number];

export type TileRef = Coords | ResolvedTileRef;

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

export interface TilesetUVRegion {
  offsetU: number;
  offsetV: number;
  scaleU: number;
  scaleV: number;
}

export interface TilesetDefinition {
  id: string;
  src: string;
  /** Tile width/height in pixels (tiles are square) */
  tileSize: number;
  /**
   * Number of tile columns in the atlas.
   * @default Math.floor(image.width / tileSize)
   */
  cols?: number;
  /**
   * Number of tile rows in the atlas.
   * @default Math.floor(image.height / tileSize)
   */
  rows?: number;
}

export type ResolvedTilesetDefinition = TilesetDefinition & {
  cols: number;
  rows: number;
};

export interface AtlasSize {
  width: number;
  height: number;
}

/**
 * Fills in a missing tile grid, flooring partial tiles out of it.
 */
export function resolveTilesetDefinition(
  def: TilesetDefinition,
  size: AtlasSize
): ResolvedTilesetDefinition {
  return {
    ...def,
    cols: def.cols ?? Math.floor(size.width / def.tileSize),
    rows: def.rows ?? Math.floor(size.height / def.tileSize)
  };
}

/**
 * Image or repacked canvas backing an atlas.
 */
export type TilesetImage = HTMLImageElement | HTMLCanvasElement;

export type TilesetTexture = THREE.Texture<TilesetImage>;
