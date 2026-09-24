// Import Third-party Dependencies
import { textureAssetKind } from "@jolly-pixel/asset-server/backend";
import {
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
  openSharedTabWorkspace,
  type StandaloneWorkspace
} from "@jolly-pixel/editor.host/offline";
import { DEFAULT_TILE_SIZE } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  CHUNK_SIZE,
  DEFAULT_TILESET_ID
} from "./worldSeed.ts";

// CONSTANTS
const kTilesetUrl = "textures/tileset.png";

export async function openOfflineWorkspace(
  name: string = "default"
): Promise<StandaloneWorkspace> {
  const response = await fetch(kTilesetUrl);
  if (!response.ok) {
    throw new Error(`Unable to load "${kTilesetUrl}" (${response.status}).`);
  }

  const tilesetAssetId = crypto.randomUUID();
  const tileset = await createTilesetDocument(
    new Uint8Array(await response.arrayBuffer()),
    {
      id: DEFAULT_TILESET_ID,
      asset: tilesetAsset(tilesetAssetId),
      tileSize: DEFAULT_TILE_SIZE
    }
  );

  return openSharedTabWorkspace({
    name,
    handlers: [
      pixelArtAssetKind({ defaultSize: tileset.size }),
      voxelMapAssetKind({ chunkSize: CHUNK_SIZE }),
      textureAssetKind()
    ],
    storage: "indexeddb",
    seed: {
      "textures/block.pixelart": {
        id: tilesetAssetId,
        kind: PIXEL_ART_KIND,
        content: () => tileset.content
      },
      "maps/overworld.voxelmap.json": {
        id: crypto.randomUUID(),
        kind: VOXEL_MAP_KIND,
        content: () => createVoxelMapDocument({
          chunkSize: CHUNK_SIZE,
          tileset: tileset.definition
        })
      }
    }
  });
}
