// Import Third-party Dependencies
import type {
  BlockDefinition,
  BlocksetDefinition
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  AtlasCanvas,
  type AtlasTilePainter
} from "../shared/AtlasCanvas.ts";
import { valueNoise } from "../shared/valueNoise.ts";

// CONSTANTS
const kTileSize = 16;
const kCols = 4;

export const TransparencyBlock = {
  Stone: 1,
  Grass: 2,
  Sand: 3,
  Plank: 4,
  Log: 5,
  Ruby: 6,
  Glass: 7,
  Water: 8,
  Leaves: 9,
  Grate: 10,
  Window: 11,
  AlphaRamp: 12,
  StoneRamp: 13,
  StoneStair: 14,
  PlankSlab: 15,
  StonePole: 16,
  LeavesSolid: 17,
  GrateSolid: 18
} as const;

export type TransparencyBlockId = typeof TransparencyBlock[keyof typeof TransparencyBlock];

interface BlockSpec {
  id: TransparencyBlockId;
  name: string;
  shapeId: BlockDefinition["shapeId"];
  paint: AtlasTilePainter;
  collidable?: boolean;
  alphaMode?: "opaque" | "mask" | "blend";
}

function speckled(
  color: string,
  shade: string,
  density = 0.25
): AtlasTilePainter {
  return (context, size) => {
    context.fillStyle = color;
    context.fillRect(0, 0, size, size);
    context.fillStyle = shade;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (valueNoise(x, y) < density) {
          context.fillRect(x, y, 1, 1);
        }
      }
    }
  };
}

function striped(
  color: string,
  shade: string,
  vertical = false
): AtlasTilePainter {
  return (context, size) => {
    context.fillStyle = color;
    context.fillRect(0, 0, size, size);
    context.fillStyle = shade;
    for (let i = 3; i < size; i += 5) {
      if (vertical) {
        context.fillRect(i, 0, 1, size);
      }
      else {
        context.fillRect(0, i, size, 1);
      }
    }
  };
}

function paintLeaves(
  context: CanvasRenderingContext2D,
  size: number
): void {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = valueNoise(x + 0.5, y + 0.5);
      if (n < 0.22) {
        continue;
      }

      context.fillStyle = n < 0.55 ? "#3f7530" : "#57a03d";
      context.fillRect(x, y, 1, 1);
    }
  }
}

function paintGrate(
  context: CanvasRenderingContext2D,
  size: number
): void {
  context.fillStyle = "#6f7581";
  for (let i = 0; i < size; i += 5) {
    context.fillRect(i, 0, 2, size);
    context.fillRect(0, i, size, 2);
  }
}

function paintWindow(
  context: CanvasRenderingContext2D,
  size: number
): void {
  context.fillStyle = "#8a6a3d";
  context.fillRect(0, 0, size, size);
  context.clearRect(3, 3, size - 6, size - 6);
}

function paintAlphaRamp(
  context: CanvasRenderingContext2D,
  size: number
): void {
  for (let x = 0; x < size; x++) {
    context.fillStyle = `rgba(255, 179, 71, ${(x + 0.5) / size})`;
    context.fillRect(x, 0, 1, size);
  }
}

function paintGlass(
  context: CanvasRenderingContext2D,
  size: number
): void {
  context.fillStyle = "rgba(191, 233, 255, 0.35)";
  context.fillRect(0, 0, size, size);
  context.fillStyle = "rgba(143, 208, 238, 0.8)";
  context.fillRect(0, 0, size, 1);
  context.fillRect(0, size - 1, size, 1);
  context.fillRect(0, 0, 1, size);
  context.fillRect(size - 1, 0, 1, size);
  context.fillStyle = "rgba(255, 255, 255, 0.55)";
  for (let i = 2; i < size - 4; i++) {
    context.fillRect(i, size - 3 - i, 2, 2);
  }
}

const kBlockSpecs: BlockSpec[] = [
  { id: TransparencyBlock.Stone, name: "Stone", shapeId: "cube", paint: speckled("#8d8d92", "#7c7c82") },
  { id: TransparencyBlock.Grass, name: "Grass", shapeId: "cube", paint: speckled("#6aa84f", "#5c9445") },
  { id: TransparencyBlock.Sand, name: "Sand", shapeId: "cube", paint: speckled("#ded3a2", "#cdc08c") },
  { id: TransparencyBlock.Plank, name: "Plank", shapeId: "cube", paint: striped("#a9793f", "#8d6231") },
  { id: TransparencyBlock.Log, name: "Log", shapeId: "cube", paint: striped("#6d5136", "#57402b", true) },
  { id: TransparencyBlock.Ruby, name: "Ruby", shapeId: "cube", paint: speckled("#d4404a", "#b8303a", 0.15) },
  { id: TransparencyBlock.Glass, name: "Glass", shapeId: "cube", paint: paintGlass, alphaMode: "blend" },
  {
    id: TransparencyBlock.Water,
    name: "Water",
    shapeId: "cube",
    paint: striped("rgba(63, 127, 208, 0.55)", "rgba(90, 149, 221, 0.55)"),
    alphaMode: "blend",
    collidable: false
  },
  {
    id: TransparencyBlock.Leaves,
    name: "Leaves",
    shapeId: "cube",
    paint: paintLeaves,
    alphaMode: "mask",
    collidable: false
  },
  { id: TransparencyBlock.Grate, name: "Grate", shapeId: "cube", paint: paintGrate, alphaMode: "mask" },
  { id: TransparencyBlock.Window, name: "Window", shapeId: "cube", paint: paintWindow, alphaMode: "mask" },
  {
    id: TransparencyBlock.AlphaRamp,
    name: "AlphaRamp",
    shapeId: "cube",
    paint: paintAlphaRamp,
    alphaMode: "blend"
  },
  {
    id: TransparencyBlock.StoneRamp,
    name: "StoneRamp",
    shapeId: "ramp",
    paint: speckled("#9a9aa2", "#84848c")
  },
  {
    id: TransparencyBlock.StoneStair,
    name: "StoneStair",
    shapeId: "stair",
    paint: speckled("#9a9aa2", "#84848c")
  },
  {
    id: TransparencyBlock.PlankSlab,
    name: "PlankSlab",
    shapeId: "slabBottom",
    paint: striped("#b98a4d", "#9c703b")
  },
  {
    id: TransparencyBlock.StonePole,
    name: "StonePole",
    shapeId: "poleY",
    paint: speckled("#9a9aa2", "#84848c")
  },
  {
    id: TransparencyBlock.LeavesSolid,
    name: "LeavesSolid",
    shapeId: "cube",
    paint: paintLeaves,
    collidable: false
  },
  { id: TransparencyBlock.GrateSolid, name: "GrateSolid", shapeId: "cube", paint: paintGrate }
];

export interface TransparencyBlockset {
  definition: BlocksetDefinition;
  blocks: BlockDefinition[];
}

export function createTransparencyBlockset(
  id = "transparency"
): TransparencyBlockset {
  const atlas = new AtlasCanvas({
    cols: kCols,
    rows: Math.ceil(kBlockSpecs.length / kCols),
    tileSize: kTileSize
  });

  const blocks = kBlockSpecs.map((spec, index): BlockDefinition => {
    const tile = atlas.tileAt(index);
    atlas.paint(tile, spec.paint);

    return {
      id: spec.id,
      name: spec.name,
      shapeId: spec.shapeId,
      collidable: spec.collidable ?? true,
      alphaMode: spec.alphaMode ?? "opaque",
      faceTextures: {},
      defaultTexture: tile
    };
  });

  return {
    definition: atlas.toBlockset(id),
    blocks
  };
}
