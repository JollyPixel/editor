// Import Third-party Dependencies
import type { AssetSeedMap } from "@jolly-pixel/asset-server";
import { PIXEL_ART_KIND } from "@jolly-pixel/asset.pixel-art";
import {
  createVoxelModelFile,
  encodeVoxelModelFile,
  VOXEL_MODEL_KIND
} from "@jolly-pixel/asset.voxel-model";

// CONSTANTS
export const TEXTURE_SIZE = {
  x: 64,
  y: 64
};

export interface ModelProject {
  seed: AssetSeedMap;
}

export function encodeModelFile(
  textureId: string
): Uint8Array {
  return encodeVoxelModelFile(
    createVoxelModelFile({
      texture: {
        id: textureId,
        kind: PIXEL_ART_KIND
      }
    })
  );
}

export function createModelProject(
  textureAssetId: string
): ModelProject {
  return {
    seed: {
      "textures/model.pixelart": {
        id: textureAssetId,
        kind: PIXEL_ART_KIND
      },
      "models/model.voxelmodel.json": {
        id: crypto.randomUUID(),
        kind: VOXEL_MODEL_KIND,
        content: () => encodeModelFile(textureAssetId)
      }
    }
  };
}
