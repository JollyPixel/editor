// Import Third-party Dependencies
import type { AssetSeedMap } from "@jolly-pixel/asset-server";
import { SCENE_KIND } from "@jolly-pixel/asset.scene";
import {
  blocksetAsset,
  createBlocksetFile,
  createVoxelMapFile,
  encodeBlocksetFile,
  BLOCKSET_KIND,
  VOXEL_MAP_KIND
} from "@jolly-pixel/asset.voxel-map";
import {
  DEFAULT_CHUNK_SIZE,
  encodeVoxelWorld
} from "@jolly-pixel/voxel.renderer";

// CONSTANTS
const kBlocksetId = "default";

export interface SceneProject {
  seed: AssetSeedMap;
}

export function createSceneProject(): SceneProject {
  const blocksetAssetId = crypto.randomUUID();

  return {
    seed: {
      "scenes/main.scene.json": {
        id: crypto.randomUUID(),
        kind: SCENE_KIND
      },
      "maps/ground.blockset.json": {
        id: blocksetAssetId,
        kind: BLOCKSET_KIND,
        content: () => encodeBlocksetFile(createBlocksetFile())
      },
      "maps/ground.voxelmap.json": {
        id: crypto.randomUUID(),
        kind: VOXEL_MAP_KIND,
        content: () => encodeVoxelWorld(
          createVoxelMapFile({
            chunkSize: DEFAULT_CHUNK_SIZE,
            blocksets: [
              {
                id: kBlocksetId,
                asset: blocksetAsset(blocksetAssetId)
              }
            ]
          })
        )
      }
    }
  };
}
