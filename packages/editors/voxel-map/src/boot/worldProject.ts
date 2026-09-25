// Import Third-party Dependencies
import {
  textureAssetKind,
  type AssetBackendTuning,
  type AssetKindHandler,
  type AssetSeedMap
} from "@jolly-pixel/asset-server/backend";
import {
  PIXEL_ART_KIND,
  pixelArtAssetKind
} from "@jolly-pixel/asset.pixel-art";
import {
  createTilesetDocument,
  createVoxelMapDocument,
  tilesetAsset,
  VOXEL_MAP_KIND,
  voxelMapAssetKind,
  type TilesetDocument
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
  png: Uint8Array,
  assetId: string
): Promise<TilesetDocument> {
  return createTilesetDocument(png, {
    id: DEFAULT_TILESET_ID,
    asset: tilesetAsset(assetId),
    tileSize: DEFAULT_TILE_SIZE
  });
}

export async function createWorldProject(
  tilesetPng: Uint8Array,
  tilesetAssetId: string
): Promise<WorldProject> {
  const tileset = await createDefaultTileset(tilesetPng, tilesetAssetId);

  return {
    handlers: [
      pixelArtAssetKind({ defaultSize: tileset.size }),
      voxelMapAssetKind(),
      textureAssetKind()
    ],
    seed: {
      "textures/block.pixelart": {
        id: tilesetAssetId,
        kind: PIXEL_ART_KIND,
        content: () => tileset.content
      },
      "maps/overworld.voxelmap.json": {
        id: crypto.randomUUID(),
        kind: VOXEL_MAP_KIND,
        content: () => createVoxelMapDocument({
          chunkSize: DEFAULT_CHUNK_SIZE,
          tileset: tileset.definition
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
