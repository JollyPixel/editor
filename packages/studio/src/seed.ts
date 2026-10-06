// Import Third-party Dependencies
import type { AssetSeedMap } from "@jolly-pixel/asset-server";
import {
  createPixelArtDocument,
  PIXEL_ART_KIND
} from "@jolly-pixel/asset.pixel-art";
import {
  createVoxelMapDocument,
  encodeBlocksetDocument,
  blocksetAsset,
  blocksetDocumentFromPng,
  BLOCKSET_KIND,
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
const kBlocksetUrl = "textures/blockset.png";
const kBlocksetAssetId = "blockset-overworld";
const kMapAssetId = "map-overworld";
const kModelTextureAssetId = "model-texture";
const kModelAssetId = "model-default";
const kBlocksetId = "default";

export async function createStudioSeed(
  blocksetPng: Uint8Array
): Promise<AssetSeedMap> {
  const blockset = await blocksetDocumentFromPng(blocksetPng, {
    tileSize: DEFAULT_TILE_SIZE
  });

  return {
    "maps/overworld.blockset.json": {
      id: kBlocksetAssetId,
      kind: BLOCKSET_KIND,
      content: () => encodeBlocksetDocument(blockset)
    },
    "maps/overworld.voxelmap.json": {
      id: kMapAssetId,
      kind: VOXEL_MAP_KIND,
      content: () => createVoxelMapDocument({
        chunkSize: DEFAULT_CHUNK_SIZE,
        blocksets: [
          {
            id: kBlocksetId,
            asset: blocksetAsset(kBlocksetAssetId)
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
  const response = await fetch(kBlocksetUrl);
  if (!response.ok) {
    throw new Error(`Unable to load "${kBlocksetUrl}" (${response.status}).`);
  }

  return createStudioSeed(
    new Uint8Array(await response.arrayBuffer())
  );
}
