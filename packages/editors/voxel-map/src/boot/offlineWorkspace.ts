// Import Third-party Dependencies
import { textureAssetKind } from "@jolly-pixel/asset-server/backend";
import {
  PIXEL_ART_KIND,
  pixelArtAssetKind
} from "@jolly-pixel/asset.pixel-art";
import {
  tilesetAsset,
  VOXEL_MAP_KIND,
  voxelMapAssetKind
} from "@jolly-pixel/asset.voxel-map";
import { OfflineWorkspace } from "@jolly-pixel/editor.host/offline";
import { DEFAULT_TILE_SIZE } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  CHUNK_SIZE,
  DEFAULT_TILESET_ID,
  encodeTilesetDocument,
  encodeWorldDocument,
  tilesetSeedFromPng
} from "./worldSeed.ts";

// CONSTANTS
export const OFFLINE_MAP_ID = "offline-map";

const kOfflineTilesetAssetId = "offline-tileset";
const kTilesetUrl = "textures/tileset.png";

export async function openOfflineWorkspace(): Promise<OfflineWorkspace> {
  const response = await fetch(kTilesetUrl);
  if (!response.ok) {
    throw new Error(`Unable to load "${kTilesetUrl}" (${response.status}).`);
  }

  const tileset = await tilesetSeedFromPng(
    new Uint8Array(await response.arrayBuffer()),
    {
      id: DEFAULT_TILESET_ID,
      asset: tilesetAsset(kOfflineTilesetAssetId),
      tileSize: DEFAULT_TILE_SIZE
    }
  );

  return OfflineWorkspace.open({
    handlers: [
      pixelArtAssetKind({ defaultSize: tileset.size }),
      voxelMapAssetKind({ chunkSize: CHUNK_SIZE }),
      textureAssetKind()
    ],
    seed: {
      "textures/block.pixelart": {
        id: kOfflineTilesetAssetId,
        kind: PIXEL_ART_KIND,
        content: () => encodeTilesetDocument(tileset)
      },
      "maps/overworld.voxelmap.json": {
        id: OFFLINE_MAP_ID,
        kind: VOXEL_MAP_KIND,
        content: () => encodeWorldDocument(tileset.definition)
      }
    }
  });
}
