// Import Third-party Dependencies
import type {
  AssetBackendTuning,
  AssetSeedMap
} from "@jolly-pixel/asset-server";
import {
  createTilesetDocument,
  createVoxelMapDocument,
  encodeTilesetDocument,
  tilesetAsset,
  TILESET_KIND,
  VOXEL_MAP_KIND,
  type TilesetAssetDocument
} from "@jolly-pixel/asset.voxel-map";
import {
  DEFAULT_CHUNK_SIZE,
  DEFAULT_TILE_SIZE
} from "@jolly-pixel/voxel.renderer";

// CONSTANTS
export const DEFAULT_TILESET_ID = "default";
export const DEFAULT_TILESET_SIZE = {
  x: 512,
  y: 512
} as const;
const kMiB = 1024 * 1024;

export const WORLD_BACKEND_TUNING = {
  catalogArchiveLimits: {
    maxEntryBytes: 64 * kMiB,
    maxBytes: 128 * kMiB
  }
} as const satisfies AssetBackendTuning;

export interface DefaultSeed {
  seed: AssetSeedMap;
  backend: AssetBackendTuning;
}

export function createDefaultTileset(): TilesetAssetDocument {
  return createTilesetDocument({
    tileSize: DEFAULT_TILE_SIZE,
    size: DEFAULT_TILESET_SIZE
  });
}

export function createDefaultSeed(
  tilesetAssetId: string = crypto.randomUUID()
): DefaultSeed {
  return {
    seed: {
      "maps/overworld.tileset.json": {
        id: tilesetAssetId,
        kind: TILESET_KIND,
        content: () => encodeTilesetDocument(createDefaultTileset())
      },
      "maps/overworld.voxelmap.json": {
        id: crypto.randomUUID(),
        kind: VOXEL_MAP_KIND,
        content: () => createVoxelMapDocument({
          chunkSize: DEFAULT_CHUNK_SIZE,
          tilesets: [
            {
              id: DEFAULT_TILESET_ID,
              asset: tilesetAsset(tilesetAssetId)
            }
          ]
        })
      }
    },
    backend: WORLD_BACKEND_TUNING
  };
}
