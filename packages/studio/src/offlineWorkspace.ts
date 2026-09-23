// Import Third-party Dependencies
import { textureAssetKind } from "@jolly-pixel/asset-server/backend";
import { pixelArtAssetKind } from "@jolly-pixel/asset.pixel-art";
import { voxelMapAssetKind } from "@jolly-pixel/asset.voxel-map";
import { voxelModelAssetKind } from "@jolly-pixel/asset.voxel-model";
import {
  openSharedTabWorkspace,
  type StandaloneWorkspace
} from "@jolly-pixel/editor.host/offline";

// Import Internal Dependencies
import {
  CHUNK_SIZE,
  createStudioSeedFromPng
} from "./seed.ts";

// CONSTANTS
export const STUDIO_OFFLINE_WORKSPACE = "studio";
const kTilesetUrl = new URL("../vite/seed/tileset.png", import.meta.url);

export async function openStudioOfflineWorkspace(): Promise<StandaloneWorkspace> {
  const response = await fetch(kTilesetUrl);
  if (!response.ok) {
    throw new Error(`Unable to load studio tileset (${response.status}).`);
  }
  const seed = await createStudioSeedFromPng(
    new Uint8Array(await response.arrayBuffer())
  );

  return openSharedTabWorkspace({
    name: STUDIO_OFFLINE_WORKSPACE,
    handlers: [
      pixelArtAssetKind({ defaultSize: seed.tilesetSize }),
      voxelMapAssetKind({ chunkSize: CHUNK_SIZE }),
      voxelModelAssetKind(),
      textureAssetKind()
    ],
    seed: seed.assets
  });
}
