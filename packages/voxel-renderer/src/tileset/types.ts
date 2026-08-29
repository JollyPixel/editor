export interface TileRef {
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

export type TileRefIn = Coords | TileRef;

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
