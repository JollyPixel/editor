// Import Third-party Dependencies
import {
  textureAssetKind,
  type AssetBackendTuning,
  type AssetKindHandler,
  type AssetSeedMap
} from "@jolly-pixel/asset-server";
import {
  createVoxelMapDocument,
  encodeTilesetDocument,
  tilesetAsset,
  tilesetAssetKind,
  tilesetDocumentFromPng,
  TILESET_KIND,
  VOXEL_MAP_KIND,
  voxelMapAssetKind,
  type TilesetAssetDocument
} from "@jolly-pixel/asset.voxel-map";
import {
  DEFAULT_CHUNK_SIZE,
  DEFAULT_TILE_SIZE
} from "@jolly-pixel/voxel.renderer";

// CONSTANTS
export const DEFAULT_TILESET_ID = "default";
const kTilesetUrl = "textures/tileset.png";
const kMiB = 1024 * 1024;

export const WORLD_BACKEND_TUNING = {
  catalogArchiveLimits: {
    maxEntryBytes: 64 * kMiB,
    maxBytes: 128 * kMiB
  }
} as const satisfies AssetBackendTuning;

export interface WorldProject {
  handlers: AssetKindHandler[];
  seed: AssetSeedMap;
  backend: AssetBackendTuning;
}

export function createDefaultTileset(
  png: Uint8Array
): Promise<TilesetAssetDocument> {
  return tilesetDocumentFromPng(png, {
    tileSize: DEFAULT_TILE_SIZE
  });
}

export async function createWorldProject(
  tilesetPng: Uint8Array,
  tilesetAssetId: string
): Promise<WorldProject> {
  const tileset = await createDefaultTileset(tilesetPng);

  return {
    handlers: [
      tilesetAssetKind(),
      voxelMapAssetKind(),
      textureAssetKind()
    ],
    seed: {
      "tilesets/block.tileset.json": {
        id: tilesetAssetId,
        kind: TILESET_KIND,
        content: () => encodeTilesetDocument(tileset)
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

export async function loadWorldProject(): Promise<WorldProject> {
  const response = await fetch(kTilesetUrl);
  if (!response.ok) {
    throw new Error(`Unable to load "${kTilesetUrl}" (${response.status}).`);
  }

  return createWorldProject(
    new Uint8Array(await response.arrayBuffer()),
    crypto.randomUUID()
  );
}
