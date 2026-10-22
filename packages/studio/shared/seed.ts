// Import Third-party Dependencies
import type { AssetSeedMap } from "@jolly-pixel/asset-server";
import { PIXEL_ART_KIND } from "@jolly-pixel/asset.pixel-art";
import {
  createPixelArtFile,
  encodePixelArtFile
} from "@jolly-pixel/pixel-draw.renderer";
import {
  createVoxelMapFile,
  encodeBlocksetFile,
  blocksetAsset,
  blocksetFileFromPng,
  BLOCKSET_KIND,
  VOXEL_MAP_KIND
} from "@jolly-pixel/asset.voxel-map";
import {
  createVoxelModelFile,
  encodeVoxelModelFile,
  VOXEL_MODEL_KIND
} from "@jolly-pixel/asset.voxel-model";
import {
  DEFAULT_CHUNK_SIZE,
  DEFAULT_TILE_SIZE,
  encodeVoxelWorld
} from "@jolly-pixel/voxel.renderer";

// CONSTANTS
export const TEXTURE_SIZE = {
  x: 64,
  y: 64
};
const kBlocksetAssetId = "blockset-overworld";
const kMapAssetId = "map-overworld";
const kModelTextureAssetId = "model-texture";
const kModelAssetId = "model-default";
const kBlocksetId = "default";

export async function createStudioSeed(
  blocksetPng: Uint8Array
): Promise<AssetSeedMap> {
  const blockset = await blocksetFileFromPng(blocksetPng, {
    tileSize: DEFAULT_TILE_SIZE
  });

  return {
    "maps/overworld.blockset.json": {
      id: kBlocksetAssetId,
      kind: BLOCKSET_KIND,
      content: () => encodeBlocksetFile(blockset)
    },
    "maps/overworld.voxelmap.json": {
      id: kMapAssetId,
      kind: VOXEL_MAP_KIND,
      content: () => encodeVoxelWorld(
        createVoxelMapFile({
          chunkSize: DEFAULT_CHUNK_SIZE,
          blocksets: [
            {
              id: kBlocksetId,
              asset: blocksetAsset(kBlocksetAssetId)
            }
          ]
        })
      )
    },
    "models/model.pixelart": {
      id: kModelTextureAssetId,
      kind: PIXEL_ART_KIND,
      content: () => encodePixelArtFile(
        createPixelArtFile(TEXTURE_SIZE)
      )
    },
    "models/model.voxelmodel.json": {
      id: kModelAssetId,
      kind: VOXEL_MODEL_KIND,
      content: () => encodeVoxelModelFile(
        createVoxelModelFile({
          texture: {
            id: kModelTextureAssetId,
            kind: PIXEL_ART_KIND
          }
        })
      )
    }
  };
}
