// Import Third-party Dependencies
import {
  PORTS,
  socketUrl
} from "@jolly-pixel/e2e";
import {
  e2eFolder,
  editorFixture
} from "@jolly-pixel/e2e/editor";
import { PIXEL_ART_KIND } from "@jolly-pixel/asset.pixel-art";
import {
  createVoxelMapDocument,
  VOXEL_MAP_KIND,
  tilesetAsset
} from "@jolly-pixel/asset.voxel-map";

// Import Internal Dependencies
import {
  CHUNK_SIZE,
  readDefaultTileset
} from "../../vite/worldSeed.ts";

export { expect } from "@playwright/test";

export interface E2EWorld {
  id: string;
  tilesetId: string;
}

export const test = editorFixture<E2EWorld>({
  socketUrl: socketUrl(PORTS.voxelMap),
  editor: {
    maxFps: 10,
    query: {
      samples: "0"
    }
  },
  async create(catalog) {
    const folder = e2eFolder();
    const tileset = await readDefaultTileset("");
    const tilesetId = await catalog.create(
      `${folder}/tileset.pixelart`,
      tileset.content,
      { kind: PIXEL_ART_KIND }
    );
    const id = await catalog.create(
      `${folder}/world.voxelmap.json`,
      createVoxelMapDocument({
        chunkSize: CHUNK_SIZE,
        tileset: {
          ...tileset.definition,
          asset: tilesetAsset(tilesetId)
        }
      }),
      { kind: VOXEL_MAP_KIND }
    );

    return {
      id,
      tilesetId
    };
  }
});
