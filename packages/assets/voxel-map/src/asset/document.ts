// Import Third-party Dependencies
import {
  pixelArtDocumentFromPng,
  type EncodedPixelArt
} from "@jolly-pixel/asset.pixel-art";
import {
  blocksFromTileset,
  encodeVoxelDocument,
  resolveTilesetDefinition,
  type ResolvedTilesetDefinition,
  type TilesetDefinition
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { VoxelMapState } from "./VoxelMapState.ts";

// CONSTANTS
const kDefaultBlockLimit = 32;
const kDefaultLayerName = "Ground";

export interface VoxelMapDocumentOptions {
  chunkSize: number;
  tileset: ResolvedTilesetDefinition;
  /**
   * Maximum number of blocks registered from the tileset tiles.
   * @default 32
   */
  blockLimit?: number;
  /**
   * @default "Ground"
   */
  layer?: string;
}

export interface TilesetDocument extends EncodedPixelArt {
  definition: ResolvedTilesetDefinition;
}

export function createVoxelMapDocument(
  options: VoxelMapDocumentOptions
): Uint8Array {
  const {
    chunkSize,
    tileset,
    blockLimit = kDefaultBlockLimit,
    layer = kDefaultLayerName
  } = options;
  const {
    cols: _cols,
    rows: _rows,
    ...source
  } = tileset;

  const state = new VoxelMapState(chunkSize);
  state.tilesets.add(source);
  state.blocks.registerMany(
    blocksFromTileset(tileset, {
      limit: blockLimit
    })
  );
  state.world.addLayer(layer);

  return encodeVoxelDocument(state.toJSON());
}

export async function createTilesetDocument(
  png: Uint8Array,
  definition: TilesetDefinition
): Promise<TilesetDocument> {
  const { size, content } = await pixelArtDocumentFromPng(png);

  return {
    size,
    content,
    definition: resolveTilesetDefinition(definition, {
      width: size.x,
      height: size.y
    })
  };
}
