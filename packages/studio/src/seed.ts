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
export const TILESET_ASSET_ID = "tileset-default";
export const MAP_ASSET_ID = "map-overworld";
export const MODEL_TEXTURE_ASSET_ID = "model-texture";
export const MODEL_ASSET_ID = "model-default";
export const CHUNK_SIZE = 16;
export const MODEL_TEXTURE_SIZE = { x: 64, y: 64 };
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
    asset: tilesetAsset(TILESET_ASSET_ID),
    tileSize: DEFAULT_TILE_SIZE
  });

  return {
    handlers: [
      pixelArtAssetKind({ defaultSize: tileset.size }),
      voxelMapAssetKind({ chunkSize: CHUNK_SIZE }),
      voxelModelAssetKind(),
      textureAssetKind()
    ],
    seed: {
      "textures/tileset.pixelart": {
        id: TILESET_ASSET_ID,
        kind: PIXEL_ART_KIND,
        content: () => tileset.content
      },
      "maps/overworld.voxelmap.json": {
        id: MAP_ASSET_ID,
        kind: VOXEL_MAP_KIND,
        content: () => createVoxelMapDocument({
          chunkSize: CHUNK_SIZE,
          tileset: tileset.definition
        })
      },
      "textures/model.pixelart": {
        id: MODEL_TEXTURE_ASSET_ID,
        kind: PIXEL_ART_KIND,
        content: () => createPixelArtDocument(MODEL_TEXTURE_SIZE)
      },
      "models/model.voxelmodel.json": {
        id: MODEL_ASSET_ID,
        kind: VOXEL_MODEL_KIND,
        content: () => encodeVoxelModelDocument(
          createVoxelModelDocument({
            texture: {
              id: MODEL_TEXTURE_ASSET_ID,
              kind: PIXEL_ART_KIND
            }
          })
        )
      }
    }
  };
}
