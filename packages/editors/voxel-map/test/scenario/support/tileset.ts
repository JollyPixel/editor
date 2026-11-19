// Import Node.js Dependencies
import fs from "node:fs/promises";

// Import Third-party Dependencies
import { test } from "@playwright/test";
import {
  createBlocksetFile,
  encodeBlocksetFile
} from "@jolly-pixel/asset.voxel-map";
import {
  createPixelBufferFromPng,
  PixelDocumentState,
  serializePixelDocument
} from "@jolly-pixel/pixel-draw.renderer";
import {
  composeBlockId,
  type BlockAlphaMode,
  type BlockDefinition,
  type BlockShapeID,
  type FaceSlotName,
  type TileRef
} from "@jolly-pixel/voxel.renderer";

// CONSTANTS
const kTilesetPng = new URL(
  "../fixtures/placeholder_tileset_256.png",
  import.meta.url
);
const kTilesetFile = "placeholder.blockset.json";

type Tile = readonly [col: number, row: number];

interface TilesetBlock {
  name: string;
  tile: Tile;
  shape?: BlockShapeID;
  alphaMode?: BlockAlphaMode;
  faces?: Partial<Record<FaceSlotName, Tile>>;
}

const kBlocks: readonly TilesetBlock[] = [
  { name: "Cobble", tile: [1, 1] },
  { name: "Planks", tile: [1, 2] },
  { name: "Plaster", tile: [2, 2] },
  { name: "Window", tile: [6, 0] },
  { name: "Roof", tile: [0, 3] },
  { name: "Roof slope", tile: [0, 3], shape: "ramp" },
  { name: "Grass", tile: [3, 2] },
  { name: "Sand", tile: [2, 3] },
  { name: "Water", tile: [3, 0], alphaMode: "blend" },
  { name: "Wood", tile: [1, 3] },
  { name: "Leaves", tile: [3, 3] },
  {
    name: "Compass",
    tile: [7, 6],
    faces: {
      right: [0, 6],
      left: [1, 6],
      top: [2, 6],
      bottom: [3, 6],
      front: [4, 6],
      back: [5, 6]
    }
  }
];

export const TILESET_BLOCKS: readonly string[] = kBlocks.map(
  (block) => block.name
);

export async function writeTileset(): Promise<string> {
  const buffer = await createPixelBufferFromPng(
    await fs.readFile(kTilesetPng)
  );
  const file = createBlocksetFile({
    pixels: serializePixelDocument(new PixelDocumentState({ buffer })),
    blocks: kBlocks.map(blockDefinition)
  });
  const path = test.info().outputPath(kTilesetFile);
  await fs.writeFile(path, encodeBlocksetFile(file));

  return path;
}

function blockDefinition(
  block: TilesetBlock,
  index: number
): BlockDefinition {
  const faces = Object.entries(block.faces ?? {}).map(
    ([slot, tile]) => [slot, tileRef(tile)]
  );

  return {
    id: composeBlockId(0, index + 1),
    name: block.name,
    shapeId: block.shape ?? "cube",
    defaultTexture: tileRef(block.tile),
    faceTextures: Object.fromEntries(faces),
    ...block.alphaMode === undefined ? {} : { alphaMode: block.alphaMode }
  };
}

function tileRef(
  [col, row]: Tile
): TileRef {
  return {
    col,
    row
  };
}
