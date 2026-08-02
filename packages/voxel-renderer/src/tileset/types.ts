export interface TileRef {
  col: number;
  row: number;
  tilesetId?: string;
}

/** Precomputed UV region for a specific tile in the atlas. */
export interface TilesetUVRegion {
  offsetU: number;
  offsetV: number;
  scaleU: number;
  scaleV: number;
}

export type Coords = [col: number, row: number];

export type TileRefIn = Coords | TileRef;

export interface TilesetDefinition {
  id: string;
  src: string;
  /** Tile width/height in pixels (tiles are square) */
  tileSize: number;
  /**
   * Number of tile columns in the atlas.
   * When omitted, derived automatically from the image width: Math.floor(image.width / tileSize).
   */
  cols?: number;
  /**
   * Number of tile rows in the atlas.
   * When omitted, derived automatically from the image height: Math.floor(image.height / tileSize).
   */
  rows?: number;
}
