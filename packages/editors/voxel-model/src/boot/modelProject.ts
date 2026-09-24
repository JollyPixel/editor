// Import Third-party Dependencies
import type {
  AssetKindHandler,
  AssetSeedMap
} from "@jolly-pixel/asset-server/backend";
import {
  PIXEL_ART_KIND,
  pixelArtAssetKind
} from "@jolly-pixel/asset.pixel-art";
import {
  createVoxelModelDocument,
  encodeVoxelModelDocument,
  VOXEL_MODEL_KIND,
  voxelModelAssetKind
} from "@jolly-pixel/asset.voxel-model";

// CONSTANTS
export const TEXTURE_SIZE = {
  x: 64,
  y: 64
};

export interface ModelProject {
  handlers: AssetKindHandler[];
  seed: AssetSeedMap;
}

export function encodeModelDocument(
  textureId: string
): Uint8Array {
  return encodeVoxelModelDocument(
    createVoxelModelDocument({
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
    handlers: [
      voxelModelAssetKind(),
      pixelArtAssetKind({ defaultSize: TEXTURE_SIZE })
    ],
    seed: {
      "textures/model.pixelart": {
        id: textureAssetId,
        kind: PIXEL_ART_KIND
      },
      "models/model.voxelmodel.json": {
        id: crypto.randomUUID(),
        kind: VOXEL_MODEL_KIND,
        content: () => encodeModelDocument(textureAssetId)
      }
    }
  };
}
