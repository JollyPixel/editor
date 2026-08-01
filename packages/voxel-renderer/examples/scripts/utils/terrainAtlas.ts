// Import Internal Dependencies
import {
  type BlockDefinition,
  type TilesetDefinition
} from "../../../src/index.ts";
import { TerrainBlock, type TerrainBlockId } from "./terrain.ts";

// CONSTANTS
// Tiles are flat colours, so they only need to be wide enough for the atlas
// half-texel inset to have something to bite into.
const kTileSize = 8;
const kCols = 4;

interface TerrainBlockSpec {
  id: TerrainBlockId;
  name: string;
  color: string;
  /**
   * @default true
   */
  collidable?: boolean;
}

/**
 * One flat colour per block. Position in this list is the tile position in the
 * generated atlas, left to right then top to bottom.
 */
const kBlockSpecs: TerrainBlockSpec[] = [
  { id: TerrainBlock.Grass, name: "Grass", color: "#6aa84f" },
  { id: TerrainBlock.Dirt, name: "Dirt", color: "#8a6242" },
  { id: TerrainBlock.Stone, name: "Stone", color: "#8d8d92" },
  { id: TerrainBlock.Sand, name: "Sand", color: "#ded3a2" },
  { id: TerrainBlock.Snow, name: "Snow", color: "#eef2f6" },
  { id: TerrainBlock.Water, name: "Water", color: "#3f7fd0", collidable: false },
  { id: TerrainBlock.Log, name: "Log", color: "#6d5136" },
  { id: TerrainBlock.Leaves, name: "Leaves", color: "#4f8c3b", collidable: false }
];

export interface TerrainTileset {
  definition: TilesetDefinition;
  blocks: BlockDefinition[];
}

/**
 * Builds the tileset for the noise world in memory: one solid-colour tile per
 * block, painted on a canvas and handed over as a data URL. The example ships
 * no image asset and every run renders exactly the same blocks.
 */
export function createTerrainTileset(
  id = "terrain"
): TerrainTileset {
  const rows = Math.ceil(kBlockSpecs.length / kCols);

  return {
    definition: {
      id,
      src: createAtlasCanvas(rows).toDataURL("image/png"),
      tileSize: kTileSize,
      cols: kCols,
      rows
    },
    blocks: kBlockSpecs.map(toBlockDefinition)
  };
}

function toBlockDefinition(
  spec: TerrainBlockSpec,
  index: number
): BlockDefinition {
  return {
    id: spec.id,
    name: spec.name,
    shapeId: "cube",
    collidable: spec.collidable ?? true,
    // Every face of a block shares its single colour; lighting alone separates
    // the top from the sides.
    faceTextures: {},
    defaultTexture: {
      col: index % kCols,
      row: Math.floor(index / kCols)
    }
  };
}

function createAtlasCanvas(
  rows: number
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = kCols * kTileSize;
  canvas.height = rows * kTileSize;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("terrainAtlas: unable to acquire a 2D canvas context");
  }

  for (const [index, { color }] of kBlockSpecs.entries()) {
    context.fillStyle = color;
    context.fillRect(
      (index % kCols) * kTileSize,
      Math.floor(index / kCols) * kTileSize,
      kTileSize,
      kTileSize
    );
  }

  return canvas;
}
