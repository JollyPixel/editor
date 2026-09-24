// Import Third-party Dependencies
import {
  textureAssetKind,
  type AssetKindHandler,
  type AssetSeedMap
} from "@jolly-pixel/asset-server/backend";
import {
  createPixelArtDocument,
  PIXEL_ART_KIND,
  pixelArtAssetKind
} from "@jolly-pixel/asset.pixel-art";
import {
  createTilesetDocument,
  createVoxelMapDocument,
  tilesetAsset,
  VOXEL_MAP_KIND,
  voxelMapAssetKind
} from "@jolly-pixel/asset.voxel-map";
import {
  createVoxelModelDocument,
  encodeVoxelModelDocument,
  VOXEL_MODEL_KIND,
  voxelModelAssetKind
} from "@jolly-pixel/asset.voxel-model";
import { DEFAULT_TILE_SIZE } from "@jolly-pixel/voxel.renderer";

// CONSTANTS
const kTilesetUrl = "textures/tileset.png";
const kTilesetAssetId = "tileset-default";
const kMapAssetId = "map-overworld";
const kModelTextureAssetId = "model-texture";
const kModelAssetId = "model-default";
const kChunkSize = 16;
const kModelTextureSize = {
  x: 64,
  y: 64
};
const kTilesetId = "default";

export interface StudioProject {
  handlers: AssetKindHandler[];
  seed: AssetSeedMap;
}

export async function createStudioProject(
  tilesetPng: Uint8Array
): Promise<StudioProject> {
  const tileset = await createTilesetDocument(tilesetPng, {
    id: kTilesetId,
    asset: tilesetAsset(kTilesetAssetId),
    tileSize: DEFAULT_TILE_SIZE
  });

  return {
    handlers: [
      pixelArtAssetKind({ defaultSize: tileset.size }),
      voxelMapAssetKind({ chunkSize: kChunkSize }),
      voxelModelAssetKind(),
      textureAssetKind()
    ],
    seed: {
      "textures/tileset.pixelart": {
        id: kTilesetAssetId,
        kind: PIXEL_ART_KIND,
        content: () => tileset.content
      },
      "maps/overworld.voxelmap.json": {
        id: kMapAssetId,
        kind: VOXEL_MAP_KIND,
        content: () => createVoxelMapDocument({
          chunkSize: kChunkSize,
          tileset: tileset.definition
        })
      },
      "textures/model.pixelart": {
        id: kModelTextureAssetId,
        kind: PIXEL_ART_KIND,
        content: () => createPixelArtDocument(kModelTextureSize)
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
    }
  };
}

export async function loadStudioProject(): Promise<StudioProject> {
  const response = await fetch(kTilesetUrl);
  if (!response.ok) {
    throw new Error(`Unable to load "${kTilesetUrl}" (${response.status}).`);
  }

  return createStudioProject(
    new Uint8Array(await response.arrayBuffer())
  );
}
