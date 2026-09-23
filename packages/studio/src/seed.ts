// Import Third-party Dependencies
import type { AssetSeedMap } from "@jolly-pixel/asset-server/backend";
import { PIXEL_ART_KIND } from "@jolly-pixel/asset.pixel-art";
import {
  tilesetAsset,
  VOXEL_MAP_KIND,
  VoxelMapState
} from "@jolly-pixel/asset.voxel-map";
import {
  createVoxelModelDocument,
  encodeVoxelModelDocument,
  VOXEL_MODEL_KIND
} from "@jolly-pixel/asset.voxel-model";
import {
  createPixelBufferFromPng,
  encodePixelArtDocument,
  PixelBuffer,
  serializePixelBuffer
} from "@jolly-pixel/pixel-draw.renderer";
import {
  blocksFromTileset,
  DEFAULT_TILE_SIZE,
  encodeVoxelDocument,
  resolveTilesetDefinition,
  type ResolvedTilesetDefinition
} from "@jolly-pixel/voxel.renderer";

// CONSTANTS
export const TILESET_ASSET_ID = "tileset-default";
export const MAP_ASSET_ID = "map-overworld";
export const MODEL_TEXTURE_ASSET_ID = "model-texture";
export const MODEL_ASSET_ID = "model-default";
export const CHUNK_SIZE = 16;
export const MODEL_TEXTURE_SIZE = { x: 64, y: 64 };
const kTilesetId = "default";
const kLayerName = "Ground";
const kBlockLimit = 32;

export interface StudioSeed {
  tilesetSize: {
    x: number;
    y: number;
  };
  assets: AssetSeedMap;
}

export async function createStudioSeedFromPng(
  bytes: Uint8Array
): Promise<StudioSeed> {
  const tileset = await createPixelBufferFromPng(bytes);
  const tilesetSize = tileset.size();
  const definition = resolveTilesetDefinition(
    {
      id: kTilesetId,
      asset: tilesetAsset(TILESET_ASSET_ID),
      tileSize: DEFAULT_TILE_SIZE
    },
    {
      width: tilesetSize.x,
      height: tilesetSize.y
    }
  );

  return {
    tilesetSize,
    assets: {
      "textures/tileset.pixelart": {
        id: TILESET_ASSET_ID,
        kind: PIXEL_ART_KIND,
        content: () => encodePixelArtDocument(serializePixelBuffer(tileset))
      },
      "maps/overworld.voxelmap.json": {
        id: MAP_ASSET_ID,
        kind: VOXEL_MAP_KIND,
        content: () => encodeMapDocument(definition)
      },
      "textures/model.pixelart": {
        id: MODEL_TEXTURE_ASSET_ID,
        kind: PIXEL_ART_KIND,
        content: () => encodePixelArtDocument(
          serializePixelBuffer(new PixelBuffer({ size: MODEL_TEXTURE_SIZE }))
        )
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

function encodeMapDocument(
  definition: ResolvedTilesetDefinition
): Uint8Array {
  const state = new VoxelMapState(CHUNK_SIZE);
  const {
    cols: _cols,
    rows: _rows,
    ...source
  } = definition;
  state.tilesets.add(source);
  state.blocks.registerMany(
    blocksFromTileset(definition, {
      limit: kBlockLimit
    })
  );
  state.world.addLayer(kLayerName);

  return encodeVoxelDocument(state.toJSON());
}
