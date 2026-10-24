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
import { createPixelArtFile } from "@jolly-pixel/pixel-draw.renderer";
import {
  blocksFromTileGrid,
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
export const STARTER_BLOCK_NAME = "Stone";
const kMiB = 1024 * 1024;
const kStoneShades = [
  [120, 125, 134],
  [138, 143, 152],
  [154, 159, 168]
] as const;
const kStoneEdge = [96, 100, 108] as const;

export const WORLD_BACKEND_TUNING = {
  catalog: {
    archiveLimits: {
      maxEntryBytes: 64 * kMiB,
      maxBytes: 128 * kMiB
    }
  }
} as const satisfies AssetBackendTuning;

export interface DefaultSeed {
  seed: AssetSeedMap;
  backend: AssetBackendTuning;
}

export function createDefaultBlockset(): BlocksetFile {
  return createBlocksetFile({
    tileSize: DEFAULT_TILE_SIZE,
    pixels: createPixelArtFile(DEFAULT_BLOCKSET_SIZE, paintStarterTile()),
    blocks: blocksFromTileGrid(
      {
        cols: 1,
        rows: 1
      },
      {
        map: () => {
          return { name: STARTER_BLOCK_NAME };
        }
      }
    )
  });
}

function paintStarterTile(): Uint8Array {
  const width = DEFAULT_BLOCKSET_SIZE.x;
  const pixels = new Uint8Array(width * DEFAULT_BLOCKSET_SIZE.y * 4);
  const last = DEFAULT_TILE_SIZE - 1;
  for (let y = 0; y < DEFAULT_TILE_SIZE; y++) {
    for (let x = 0; x < DEFAULT_TILE_SIZE; x++) {
      const edge = x === 0 || y === 0 || x === last || y === last;
      const shade = edge ?
        kStoneEdge :
        kStoneShades[((x * 7) ^ (y * 13) ^ (x * y)) % kStoneShades.length];
      pixels.set([...shade, 255], ((y * width) + x) * 4);
    }
  }

  return pixels;
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
