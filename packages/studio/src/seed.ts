// Import Third-party Dependencies
import type { AssetSeedMap } from "@jolly-pixel/asset-server";
import {
  createPixelArtDocument,
  PIXEL_ART_KIND
} from "@jolly-pixel/asset.pixel-art";
import {
  createVoxelMapDocument,
  encodeTilesetDocument,
  tilesetAsset,
  tilesetDocumentFromPng,
  TILESET_KIND,
  VOXEL_MAP_KIND
} from "@jolly-pixel/asset.voxel-map";
import {
  createVoxelModelDocument,
  encodeVoxelModelDocument,
  VOXEL_MODEL_KIND
} from "@jolly-pixel/asset.voxel-model";
import {
  DEFAULT_CHUNK_SIZE,
  DEFAULT_TILE_SIZE
} from "@jolly-pixel/voxel.renderer";

// CONSTANTS
export const TEXTURE_SIZE = {
  x: 64,
  y: 64
};
const kTilesetUrl = "textures/tileset.png";
const kTilesetAssetId = "tileset-overworld";
const kMapAssetId = "map-overworld";
const kModelTextureAssetId = "model-texture";
const kModelAssetId = "model-default";
const kTilesetId = "default";

export async function createStudioSeed(
  tilesetPng: Uint8Array
): Promise<AssetSeedMap> {
  const tileset = await tilesetDocumentFromPng(tilesetPng, {
    tileSize: DEFAULT_TILE_SIZE
  });

  return {
    "maps/overworld.tileset.json": {
      id: kTilesetAssetId,
      kind: TILESET_KIND,
      content: () => encodeTilesetDocument(tileset)
    },
    "maps/overworld.voxelmap.json": {
      id: kMapAssetId,
      kind: VOXEL_MAP_KIND,
      content: () => createVoxelMapDocument({
        chunkSize: DEFAULT_CHUNK_SIZE,
        tilesets: [
          {
            id: kTilesetId,
            asset: tilesetAsset(kTilesetAssetId)
          }
        ]
      })
    },
    "models/model.pixelart": {
      id: kModelTextureAssetId,
      kind: PIXEL_ART_KIND,
      content: () => createPixelArtDocument(TEXTURE_SIZE)
    },
    "models/model.voxelmodel.json": {
      id: kModelAssetId,
      kind: VOXEL_MODEL_KIND,
      content: () => encodeVoxelModelDocument(
        createVoxelModelDocument({
          texture: {
            id: kModelTextureAssetId,
            kind: PIXEL_ART_KIND
          }
        })
      )
    }
  };
}

export async function loadStudioSeed(): Promise<AssetSeedMap> {
  const response = await fetch(kTilesetUrl);
  if (!response.ok) {
    throw new Error(`Unable to load "${kTilesetUrl}" (${response.status}).`);
  }

  return createStudioSeed(
    new Uint8Array(await response.arrayBuffer())
  );
}
