// Import Internal Dependencies
import {
  type BlockDefinition,
  type TileRef,
  type TilesetDefinition
} from "../../../src/index.ts";
import { TerrainBlock, type TerrainBlockId } from "./terrain.ts";

type TilePainter = (x: number, y: number) => string;

/*
 * CONSTANTS
 * Tiles carry pixel-art detail so far terrain shows what the renderer's
 * `tileMinification` does with it.
 */
const kTileSize = 16;
const kCols = 4;

const kTiles = {
  grassTop: 0,
  grassSide: 1,
  dirt: 2,
  stone: 3,
  sand: 4,
  snow: 5,
  water: 6,
  bark: 7,
  logEnd: 8,
  leaves: 9
} as const;
type TileName = keyof typeof kTiles;

const kPainters: Record<TileName, TilePainter> = {
  grassTop: speckle(["#5e9c45", "#6aa84f", "#7dbb5c", "#4c8638"]),
  grassSide: (x, y) => {
    const fringe = 3 + (hash(x, 97) % 3);

    return y < fringe ?
      speckle(["#5e9c45", "#6aa84f", "#4c8638"])(x, y) :
      kPainters.dirt(x, y);
  },
  dirt: speckle(["#8a6242", "#7a5538", "#9a7050", "#6b4a31"]),
  stone: (x, y) => {
    const crack = (x + (y * 3)) % 11 === 0 || (x * 2) - y === 5;

    return crack ?
      "#5f5f66" :
      speckle(["#8d8d92", "#9c9ca1", "#7e7e84"])(x, y);
  },
  sand: speckle(["#ded3a2", "#d2c692", "#e8dfb4", "#c8bb86"]),
  snow: speckle(["#eef2f6", "#e2e8ef", "#f8fafc"]),
  water: (x, y) => {
    const ripple = ((x + (y * 2) + (hash(y, 7) % 4)) % 8) < 2;

    return ripple ? "#6a9fe0" : speckle(["#3f7fd0", "#3874c2"])(x, y);
  },
  bark: (x, y) => {
    const groove = (x + (hash(y >> 2, x) % 2)) % 4 === 0;

    return groove ? "#4e3a26" : speckle(["#6d5136", "#7a5c3e", "#624830"])(x, y);
  },
  logEnd: (x, y) => {
    const centre = (kTileSize - 1) / 2;
    const ring = Math.round(Math.hypot(x - centre, y - centre));

    if (ring >= 7) {
      return "#624830";
    }

    return ring % 3 === 0 ? "#9a7a50" : "#c4a171";
  },
  leaves: speckle(["#4f8c3b", "#3f7a2e", "#5f9e48", "#2f6423"])
};

interface TerrainBlockSpec {
  id: TerrainBlockId;
  name: string;
  tile: TileName;
  top?: TileName;
  bottom?: TileName;
  /**
   * @default true
   */
  collidable?: boolean;
}

const kBlockSpecs: TerrainBlockSpec[] = [
  { id: TerrainBlock.Grass, name: "Grass", tile: "grassSide", top: "grassTop", bottom: "dirt" },
  { id: TerrainBlock.Dirt, name: "Dirt", tile: "dirt" },
  { id: TerrainBlock.Stone, name: "Stone", tile: "stone" },
  { id: TerrainBlock.Sand, name: "Sand", tile: "sand" },
  { id: TerrainBlock.Snow, name: "Snow", tile: "snow" },
  { id: TerrainBlock.Water, name: "Water", tile: "water", collidable: false },
  { id: TerrainBlock.Log, name: "Log", tile: "bark", top: "logEnd", bottom: "logEnd" },
  { id: TerrainBlock.Leaves, name: "Leaves", tile: "leaves", collidable: false }
];

export interface TerrainTileset {
  definition: TilesetDefinition;
  blocks: BlockDefinition[];
}

/**
 * Builds the tileset for the noise world in memory: procedural pixel-art
 * tiles painted on a canvas and handed over as a data URL. The example ships
 * no image asset and every run renders exactly the same blocks.
 */
export function createTerrainTileset(
  id = "terrain"
): TerrainTileset {
  const rows = Math.ceil(Object.keys(kTiles).length / kCols);

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
  spec: TerrainBlockSpec
): BlockDefinition {
  const faceTextures: Partial<Record<"top" | "bottom", TileRef>> = {};
  if (spec.top) {
    faceTextures.top = tileRef(spec.top);
  }
  if (spec.bottom) {
    faceTextures.bottom = tileRef(spec.bottom);
  }

  return {
    id: spec.id,
    name: spec.name,
    shapeId: "cube",
    collidable: spec.collidable ?? true,
    faceTextures,
    defaultTexture: tileRef(spec.tile)
  };
}

function tileRef(
  name: TileName
): TileRef {
  const index = kTiles[name];

  return {
    col: index % kCols,
    row: Math.floor(index / kCols)
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

  for (const [name, index] of Object.entries(kTiles)) {
    const paint = kPainters[name as TileName];
    const originX = (index % kCols) * kTileSize;
    const originY = Math.floor(index / kCols) * kTileSize;
    for (let y = 0; y < kTileSize; y++) {
      for (let x = 0; x < kTileSize; x++) {
        context.fillStyle = paint(x, y);
        context.fillRect(originX + x, originY + y, 1, 1);
      }
    }
  }

  return canvas;
}

/**
 * Deterministic per-texel pick from a palette, weighted toward its first
 * colour.
 */
function speckle(
  palette: string[]
): TilePainter {
  return (x, y) => {
    const roll = hash(x, y) % 8;

    return roll < 4 ? palette[0] : palette[1 + (roll % (palette.length - 1))];
  };
}

function hash(
  x: number,
  y: number
): number {
  let value = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);

  return (value ^ (value >>> 16)) >>> 0;
}
