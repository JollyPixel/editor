// Import Third-party Dependencies
import type {
  AssetBackendTuning,
  AssetSeedMap
} from "@jolly-pixel/asset-server";
import {
  createBlocksetFile,
  createVoxelMapFile,
  encodeBlocksetFile,
  blocksetAsset,
  BLOCKSET_KIND,
  VOXEL_MAP_KIND,
  type BlocksetFile
} from "@jolly-pixel/asset.voxel-map";
import {
  DEFAULT_CHUNK_SIZE,
  DEFAULT_TILE_SIZE,
  encodeVoxelWorld
} from "@jolly-pixel/voxel.renderer";

// CONSTANTS
export const DEFAULT_BLOCKSET_ID = "default";
export const DEFAULT_BLOCKSET_SIZE = {
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

export function createDefaultBlockset(): BlocksetFile {
  return createBlocksetFile({
    tileSize: DEFAULT_TILE_SIZE,
    size: DEFAULT_BLOCKSET_SIZE
  });
}

export function createDefaultSeed(
  blocksetAssetId: string = crypto.randomUUID()
): DefaultSeed {
  return {
    seed: {
      "overworld.blockset.json": {
        id: blocksetAssetId,
        kind: BLOCKSET_KIND,
        content: () => encodeBlocksetFile(createDefaultBlockset())
      },
      "overworld.voxelmap.json": {
        id: crypto.randomUUID(),
        kind: VOXEL_MAP_KIND,
        content: () => encodeVoxelWorld(
          createVoxelMapFile({
            chunkSize: DEFAULT_CHUNK_SIZE,
            blocksets: [
              {
                id: DEFAULT_BLOCKSET_ID,
                asset: blocksetAsset(blocksetAssetId)
              }
            ]
          })
        )
      }
    },
    backend: WORLD_BACKEND_TUNING
  };
}
