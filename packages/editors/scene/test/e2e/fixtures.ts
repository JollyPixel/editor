// Import Third-party Dependencies
import {
  e2eFolder,
  editorFixture
} from "@jolly-pixel/e2e/editor";
import {
  createSceneFile,
  SCENE_FILE,
  SCENE_KIND
} from "@jolly-pixel/asset.scene";
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

export { expect } from "@playwright/test";

export interface E2EScene {
  id: string;
  mapName: string;
}

export const test = editorFixture<E2EScene>({
  editor: {
    maxFps: 5,
    query: {
      render: "on-demand"
    }
  },
  async create(catalog) {
    const folder = e2eFolder();
    const mapName = `map-${folder.slice(-8)}`;
    const blocksetId = await catalog.create(
      `${folder}/${mapName}.blockset.json`,
      encodeBlocksetFile(createBlocksetFile()),
      { kind: BLOCKSET_KIND }
    );
    await catalog.create(
      `${folder}/${mapName}.voxelmap.json`,
      encodeVoxelWorld(
        createVoxelMapFile({
          chunkSize: DEFAULT_CHUNK_SIZE,
          blocksets: [
            {
              id: "default",
              asset: blocksetAsset(blocksetId)
            }
          ]
        })
      ),
      { kind: VOXEL_MAP_KIND }
    );
    const id = await catalog.create(
      `${folder}/main.scene.json`,
      SCENE_FILE.encode(createSceneFile()),
      { kind: SCENE_KIND }
    );

    return {
      id,
      mapName
    };
  }
});
