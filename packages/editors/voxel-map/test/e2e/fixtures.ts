// Import Third-party Dependencies
import { test as base } from "@playwright/test";
import { CommandConsole } from "@jolly-pixel/e2e";
import {
  e2eFolder,
  editorFixture
} from "@jolly-pixel/e2e/editor";
import {
  createBlocksetFile,
  createVoxelMapFile,
  encodeBlocksetFile,
  BLOCKSET_KIND,
  VOXEL_MAP_KIND,
  blocksetAsset,
  type BlocksetFile
} from "@jolly-pixel/asset.voxel-map";
import { createPixelArtFile } from "@jolly-pixel/pixel-draw.renderer";
import {
  blocksFromTileGrid,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_TILE_SIZE,
  encodeVoxelWorld
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  DEFAULT_BLOCKSET_ID,
  DEFAULT_BLOCKSET_SIZE
} from "../../src/boot/defaultSeed.ts";
import { VoxelMapPage } from "./support/voxelMap.ts";

// CONSTANTS
const kBlockCount = 32;
export const EDITOR_OPTIONS = {
  maxFps: 10,
  query: {
    samples: "0",
    render: "on-demand"
  }
};

export { expect } from "@playwright/test";

export interface E2EWorld {
  id: string;
  blocksetId: string;
}

function createOpaqueBlockset(): BlocksetFile {
  const { x, y } = DEFAULT_BLOCKSET_SIZE;

  return createBlocksetFile({
    tileSize: DEFAULT_TILE_SIZE,
    pixels: createPixelArtFile(
      DEFAULT_BLOCKSET_SIZE,
      new Uint8Array(x * y * 4).fill(255)
    ),
    blocks: blocksFromTileGrid(
      {
        cols: x / DEFAULT_TILE_SIZE,
        rows: y / DEFAULT_TILE_SIZE
      },
      { limit: kBlockCount }
    )
  });
}

export const test = editorFixture<E2EWorld>({
  editor: EDITOR_OPTIONS,
  async create(catalog) {
    const folder = e2eFolder();
    const blocksetId = await catalog.create(
      `${folder}/blockset.blockset.json`,
      encodeBlocksetFile(createOpaqueBlockset()),
      { kind: BLOCKSET_KIND }
    );
    const id = await catalog.create(
      `${folder}/world.voxelmap.json`,
      encodeVoxelWorld(
        createVoxelMapFile({
          chunkSize: DEFAULT_CHUNK_SIZE,
          blocksets: [
            {
              id: DEFAULT_BLOCKSET_ID,
              asset: blocksetAsset(blocksetId)
            }
          ]
        })
      ),
      { kind: VOXEL_MAP_KIND }
    );

    return {
      id,
      blocksetId
    };
  }
}).extend<{
  map: VoxelMapPage;
  peerMap: VoxelMapPage;
  commands: CommandConsole;
}>({
  map: async({ page }, use) => {
    await use(new VoxelMapPage(page));
  },
  peerMap: async({ peer }, use) => {
    await use(new VoxelMapPage(peer));
  },
  commands: async({ page }, use) => {
    await use(new CommandConsole(page));
  }
});

export const offlineTest = base.extend<{ map: VoxelMapPage; }>({
  map: async({ page }, use) => {
    await use(new VoxelMapPage(page));
  }
});
