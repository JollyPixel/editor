// Import Third-party Dependencies
import {
  createPixelBufferFromPng,
  encodePixelArtDocument,
  serializePixelBuffer,
  type PixelBuffer
} from "@jolly-pixel/pixel-draw.renderer";
import { VoxelMapState } from "@jolly-pixel/asset.voxel-map";
import {
  blocksFromTileset,
  encodeVoxelDocument,
  resolveTilesetDefinition,
  type ResolvedTilesetDefinition,
  type TilesetDefinition
} from "@jolly-pixel/voxel.renderer";

// CONSTANTS
export const CHUNK_SIZE = 16;
export const DEFAULT_LAYER_NAME = "Ground";
export const DEFAULT_BLOCK_LIMIT = 32;
export const DEFAULT_TILESET_ID = "default";

export interface TilesetSeed {
  definition: ResolvedTilesetDefinition;
  size: {
    x: number;
    y: number;
  };
  buffer: PixelBuffer;
}

export async function tilesetSeedFromPng(
  png: Uint8Array,
  definition: TilesetDefinition
): Promise<TilesetSeed> {
  const buffer = await createPixelBufferFromPng(png);
  const size = buffer.size();

  return {
    definition: resolveTilesetDefinition(definition, {
      width: size.x,
      height: size.y
    }),
    size,
    buffer
  };
}

export function encodeTilesetDocument(
  tileset: TilesetSeed
): Uint8Array {
  return encodePixelArtDocument(
    serializePixelBuffer(tileset.buffer)
  );
}

export function encodeWorldDocument(
  definition: ResolvedTilesetDefinition
): Uint8Array {
  const state = new VoxelMapState(CHUNK_SIZE);
  const {
    cols: _cols,
    rows: _rows,
    ...source
  } = definition;
  state.tilesets.add(source);
  state.blocks.registerMany(
    blocksFromTileset(definition, {
      limit: DEFAULT_BLOCK_LIMIT
    })
  );
  state.world.addLayer(DEFAULT_LAYER_NAME);

  return encodeVoxelDocument(state.toJSON());
}
