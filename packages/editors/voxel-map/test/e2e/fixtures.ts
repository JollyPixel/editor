// Import Third-party Dependencies
import {
  e2eFolder,
  editorFixture
} from "@jolly-pixel/e2e/editor";
import {
  createTilesetDocument,
  createVoxelMapDocument,
  encodeTilesetDocument,
  TILESET_KIND,
  VOXEL_MAP_KIND,
  tilesetAsset,
  type TilesetAssetDocument
} from "@jolly-pixel/asset.voxel-map";
import { createPixelArtDocument } from "@jolly-pixel/pixel-draw.renderer";
import {
  blocksFromTileset,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_TILE_SIZE
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  DEFAULT_TILESET_ID,
  DEFAULT_TILESET_SIZE
} from "../../src/boot/defaultSeed.ts";

// CONSTANTS
const kBlockCount = 32;

export { expect } from "@playwright/test";

export interface E2EWorld {
  id: string;
  tilesetId: string;
}

function createOpaqueTileset(): TilesetAssetDocument {
  const { x, y } = DEFAULT_TILESET_SIZE;

  return createTilesetDocument({
    tileSize: DEFAULT_TILE_SIZE,
    pixels: createPixelArtDocument(
      DEFAULT_TILESET_SIZE,
      new Uint8Array(x * y * 4).fill(255)
    ),
    blocks: blocksFromTileset(
      {
        cols: x / DEFAULT_TILE_SIZE,
        rows: y / DEFAULT_TILE_SIZE
      },
      { limit: kBlockCount }
    )
  });
}

export const test = editorFixture<E2EWorld>({
  editor: {
    maxFps: 10,
    query: {
      samples: "0",
      render: "on-demand"
    }
  },
  async create(catalog) {
    const folder = e2eFolder();
    const tilesetId = await catalog.create(
      `${folder}/tileset.tileset.json`,
      encodeTilesetDocument(createOpaqueTileset()),
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
