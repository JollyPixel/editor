// Import Third-party Dependencies
import type * as THREE from "three";

export interface ResolvedTileRef {
  col: number;
  row: number;
  tilesetId?: string;
  /**
   * Square texture region size in source texels, anchored at the tile's
   * top-left corner.
   * @default the tileset tileSize
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

export interface TilesetUVRegion {
  offsetU: number;
  offsetV: number;
  scaleU: number;
  scaleV: number;
}

export interface TilesetDefinition {
  id: string;
  src: string;
  /**
   * Tile width/height in pixels (tiles are square).
   */
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

export type TilesetImage = HTMLImageElement | HTMLCanvasElement;

export type TilesetTexture = THREE.Texture<TilesetImage>;
