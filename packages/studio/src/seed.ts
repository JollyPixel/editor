// Import Third-party Dependencies
import {
  textureAssetKind,
  type AssetKindHandler,
  type AssetSeedMap
} from "@jolly-pixel/asset-server";
import {
  createPixelArtDocument,
  PIXEL_ART_KIND,
  pixelArtAssetKind
} from "@jolly-pixel/asset.pixel-art";
import {
  createVoxelMapDocument,
  encodeTilesetDocument,
  tilesetAsset,
  tilesetAssetKind,
  tilesetDocumentFromPng,
  TILESET_KIND,
  VOXEL_MAP_KIND,
  voxelMapAssetKind
} from "@jolly-pixel/asset.voxel-map";
import {
  createVoxelModelDocument,
  encodeVoxelModelDocument,
  VOXEL_MODEL_KIND,
  voxelModelAssetKind
} from "@jolly-pixel/asset.voxel-model";
import {
  DEFAULT_CHUNK_SIZE,
  DEFAULT_TILE_SIZE
} from "@jolly-pixel/voxel.renderer";

// CONSTANTS
const kTilesetUrl = "textures/tileset.png";
const kTilesetAssetId = "tileset-default";
const kMapAssetId = "map-overworld";
const kModelTextureAssetId = "model-texture";
const kModelAssetId = "model-default";
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
  const tileset = await tilesetDocumentFromPng(tilesetPng, {
    tileSize: DEFAULT_TILE_SIZE
  });

  return {
    handlers: [
      pixelArtAssetKind(),
      tilesetAssetKind(),
      voxelMapAssetKind(),
      voxelModelAssetKind(),
      textureAssetKind()
    ],
    seed: {
      "tilesets/tileset.tileset.json": {
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
