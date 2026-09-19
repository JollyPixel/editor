// Import Node.js Dependencies
import path from "node:path";

// Import Third-party Dependencies
import {
  encodePixelArtDocument,
  serializePixelBuffer
} from "@jolly-pixel/pixel-draw.renderer";
import {
  tilesetAsset,
  VoxelMapState
} from "@jolly-pixel/asset.voxel-map";
import {
  blocksFromTileset,
  DEFAULT_TILE_SIZE,
  encodeVoxelDocument,
  type ResolvedTilesetDefinition
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  readTilesetSeed,
  type TilesetSeed
} from "./tilesetSeed.ts";

// CONSTANTS
export const CHUNK_SIZE = 16;
export const DEFAULT_LAYER_NAME = "Ground";
export const DEFAULT_BLOCK_LIMIT = 32;
export const DEFAULT_TILESET_ID = "default";

const kTilesetFile = path.join(
  import.meta.dirname,
  "..",
  "public",
  "textures",
  "tileset.png"
);

export function readDefaultTileset(
  assetId: string
): Promise<TilesetSeed> {
  return readTilesetSeed({
    file: kTilesetFile,
    definition: {
      id: DEFAULT_TILESET_ID,
      asset: tilesetAsset(assetId),
      tileSize: DEFAULT_TILE_SIZE
    }
  });
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
