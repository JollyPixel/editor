// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import {
  PORTS,
  socketUrl
} from "@jolly-pixel/e2e";
import {
  e2eFolder,
  editorFixture
} from "@jolly-pixel/e2e/editor";
import {
  createVoxelMapDocument,
  encodeTilesetDocument,
  TILESET_KIND,
  VOXEL_MAP_KIND,
  tilesetAsset
} from "@jolly-pixel/asset.voxel-map";
import { DEFAULT_CHUNK_SIZE } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  createDefaultTileset,
  DEFAULT_TILESET_ID
} from "../../src/boot/worldProject.ts";

// CONSTANTS
const kTilesetFile = path.join(
  import.meta.dirname,
  "..",
  "..",
  "public",
  "textures",
  "tileset.png"
);

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
    const tileset = await createDefaultTileset(
      await fs.readFile(kTilesetFile)
    );
    const tilesetId = await catalog.create(
      `${folder}/tileset.tileset.json`,
      encodeTilesetDocument(tileset),
      { kind: TILESET_KIND }
    );
    const id = await catalog.create(
      `${folder}/world.voxelmap.json`,
      createVoxelMapDocument({
        chunkSize: DEFAULT_CHUNK_SIZE,
        tilesets: [
          {
            id: DEFAULT_TILESET_ID,
            asset: tilesetAsset(tilesetId)
          }
        ]
      }),
      { kind: VOXEL_MAP_KIND }
    );

    return {
      id,
      tilesetId
    };
  }
});
