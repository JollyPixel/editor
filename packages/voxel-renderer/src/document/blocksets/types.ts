// Import Third-party Dependencies
import type * as THREE from "three";

/**
 * Clockwise quarter turns of the tile image inside its face, in image space
 * where y points down. Applied before the block's own transform.
 */
export type TileRotation = 0 | 1 | 2 | 3;

export interface ResolvedTileRef {
  col: number;
  row: number;
  blocksetId?: string;
  /**
   * @default 0
   */
  rotation?: TileRotation;
  /**
   * Square texture region size in source texels, anchored at the tile's
   * top-left corner.
   * @default the blockset tileSize
   */
  size?: number;
}

export type Coords = [col: number, row: number];

export type TileRef = Coords | ResolvedTileRef;

/**
 * Normalized sub-rectangle of a tile, with `v` pointing up.
 */
export interface TileBounds {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

export interface TileSpan {
  u: number;
  v: number;
}

export interface AtlasUVRegion {
  offsetU: number;
  offsetV: number;
  scaleU: number;
  scaleV: number;
}

export interface BlocksetAssetReference {
  id: string;
  kind: string;
}

export interface BlocksetDefinition {
  id: string;
  /**
   * Block id namespace of the blockset inside a world; the first free slot
   * when omitted on declaration.
   */
  slot?: number;
  /**
   * Image URL. Absent when `asset` holds the pixels.
   */
  src?: string;
  /**
   * Catalog asset holding the pixels, tile size and blocks, resolved by the
   * host instead of `loadBlocksets()`.
   */
  asset?: BlocksetAssetReference;
  /**
   * Tile width/height in pixels (tiles are square). Required with `src`;
   * declared by the host once an `asset` blockset is loaded.
   */
  tileSize?: number;
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

export type ResolvedBlocksetDefinition = BlocksetDefinition & {
  tileSize: number;
  cols: number;
  rows: number;
};

export interface AtlasSize {
  width: number;
  height: number;
}

export type AtlasImage = HTMLImageElement | HTMLCanvasElement;

export type AtlasTexture = THREE.Texture<AtlasImage> | THREE.CompressedTexture;

export type AtlasNormalTexture = THREE.Texture<AtlasSize>;
