export interface ResolvedTileRef {
  col: number;
  row: number;
  tilesetId?: string;
}

export interface TilesetUVRegion {
  offsetU: number;
  offsetV: number;
  scaleU: number;
  scaleV: number;
}

export type Coords = [col: number, row: number];

export type TileRef = Coords | ResolvedTileRef;

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
