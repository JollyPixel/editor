// Import Internal Dependencies
import {
  type BlockDefinition,
  type TilesetDefinition
} from "../../../src/index.ts";

// CONSTANTS
const kTileSize = 16;
const kCols = 4;

type TilePainter = (
  context: CanvasRenderingContext2D,
  size: number
) => void;

/**
 * Blocks of the transparency diorama. The three groups behave differently
 * under alpha: fully opaque texels, cutout texels (holes the `alphaTest`
 * discards), and opaque texels whose translucency comes from the layer.
 */
export const TransparencyBlock = {
  Stone: 1,
  Grass: 2,
  Sand: 3,
  Plank: 4,
  Log: 5,
  Ruby: 6,
  // Opaque texels — translucency is the layer's, not the texture's.
  Glass: 7,
  Water: 8,
  // Cutout texels — holes come from the atlas alpha channel.
  Leaves: 9,
  Grate: 10,
  Window: 11,
  AlphaRamp: 12,
  // Non-cube shapes, to read the sun across slanted normals.
  StoneRamp: 13,
  StoneStair: 14,
  PlankSlab: 15,
  StonePole: 16,
  /**
   * The same cutout tiles without `transparent: true`, kept as the A side of
   * the comparison: they occlude like solid blocks and you look through the
   * holes into faces that were never emitted.
   */
  LeavesSolid: 17,
  GrateSolid: 18
} as const;

export type TransparencyBlockId = typeof TransparencyBlock[keyof typeof TransparencyBlock];

interface BlockSpec {
  id: TransparencyBlockId;
  name: string;
  shapeId: BlockDefinition["shapeId"];
  paint: TilePainter;
  /**
   * @default true
   */
  collidable?: boolean;
  /**
   * @default false
   */
  transparent?: boolean;
}

/**
 * Deterministic value noise — the atlas must be byte-identical between runs so
 * a visual difference is always the renderer's doing.
 */
function noise(
  x: number,
  y: number
): number {
  const n = Math.sin((x * 127.1) + (y * 311.7)) * 43758.5453;

  return n - Math.floor(n);
}

function speckled(
  color: string,
  shade: string,
  density = 0.25
): TilePainter {
  return (context, size) => {
    context.fillStyle = color;
    context.fillRect(0, 0, size, size);
    context.fillStyle = shade;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (noise(x, y) < density) {
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
): TilePainter {
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

/** Foliage: a flat green with holes punched straight through the alpha. */
function paintLeaves(
  context: CanvasRenderingContext2D,
  size: number
): void {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = noise(x + 0.5, y + 0.5);
      if (n < 0.22) {
        continue;
      }

      context.fillStyle = n < 0.55 ? "#3f7530" : "#57a03d";
      context.fillRect(x, y, 1, 1);
    }
  }
}

/** Metal bars over an empty background — the widest cutout gaps of the set. */
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

/** A window frame around a hole: cutout on an otherwise solid block. */
function paintWindow(
  context: CanvasRenderingContext2D,
  size: number
): void {
  context.fillStyle = "#8a6a3d";
  context.fillRect(0, 0, size, size);
  context.clearRect(3, 3, size - 6, size - 6);
}

/**
 * Alpha climbing 0 → 1 from left to right. Dragging `alphaTest` moves the cut
 * line across the block, which is the cheapest way to see what the threshold
 * actually does.
 */
function paintAlphaRamp(
  context: CanvasRenderingContext2D,
  size: number
): void {
  for (let x = 0; x < size; x++) {
    context.fillStyle = `rgba(255, 179, 71, ${(x + 0.5) / size})`;
    context.fillRect(x, 0, 1, size);
  }
}

/** Glass: fully opaque texels, plus a frame so the pane edges stay readable. */
function paintGlass(
  context: CanvasRenderingContext2D,
  size: number
): void {
  context.fillStyle = "#bfe9ff";
  context.fillRect(0, 0, size, size);
  context.fillStyle = "#8fd0ee";
  context.fillRect(0, 0, size, 1);
  context.fillRect(0, size - 1, size, 1);
  context.fillRect(0, 0, 1, size);
  context.fillRect(size - 1, 0, 1, size);
  context.fillStyle = "rgba(255, 255, 255, 0.55)";
  for (let i = 2; i < size - 4; i++) {
    context.fillRect(i, size - 3 - i, 2, 2);
  }
}

/**
 * Position in this list is the tile position in the generated atlas, left to
 * right then top to bottom.
 */
const kBlockSpecs: BlockSpec[] = [
  { id: TransparencyBlock.Stone, name: "Stone", shapeId: "cube", paint: speckled("#8d8d92", "#7c7c82") },
  { id: TransparencyBlock.Grass, name: "Grass", shapeId: "cube", paint: speckled("#6aa84f", "#5c9445") },
  { id: TransparencyBlock.Sand, name: "Sand", shapeId: "cube", paint: speckled("#ded3a2", "#cdc08c") },
  { id: TransparencyBlock.Plank, name: "Plank", shapeId: "cube", paint: striped("#a9793f", "#8d6231") },
  { id: TransparencyBlock.Log, name: "Log", shapeId: "cube", paint: striped("#6d5136", "#57402b", true) },
  { id: TransparencyBlock.Ruby, name: "Ruby", shapeId: "cube", paint: speckled("#d4404a", "#b8303a", 0.15) },
  { id: TransparencyBlock.Glass, name: "Glass", shapeId: "cube", paint: paintGlass },
  {
    id: TransparencyBlock.Water,
    name: "Water",
    shapeId: "cube",
    paint: striped("#3f7fd0", "#5a95dd"),
    collidable: false
  },
  {
    id: TransparencyBlock.Leaves,
    name: "Leaves",
    shapeId: "cube",
    paint: paintLeaves,
    transparent: true,
    collidable: false
  },
  { id: TransparencyBlock.Grate, name: "Grate", shapeId: "cube", paint: paintGrate, transparent: true },
  { id: TransparencyBlock.Window, name: "Window", shapeId: "cube", paint: paintWindow, transparent: true },
  {
    id: TransparencyBlock.AlphaRamp,
    name: "AlphaRamp",
    shapeId: "cube",
    paint: paintAlphaRamp,
    transparent: true
  },
  // Reuse the stone and plank tiles; only the shape changes.
  { id: TransparencyBlock.StoneRamp, name: "StoneRamp", shapeId: "ramp", paint: speckled("#9a9aa2", "#84848c") },
  { id: TransparencyBlock.StoneStair, name: "StoneStair", shapeId: "stair", paint: speckled("#9a9aa2", "#84848c") },
  { id: TransparencyBlock.PlankSlab, name: "PlankSlab", shapeId: "slabBottom", paint: striped("#b98a4d", "#9c703b") },
  { id: TransparencyBlock.StonePole, name: "StonePole", shapeId: "poleY", paint: speckled("#9a9aa2", "#84848c") },
  // Same tiles as Leaves and Grate, minus the flag.
  {
    id: TransparencyBlock.LeavesSolid,
    name: "LeavesSolid",
    shapeId: "cube",
    paint: paintLeaves,
    collidable: false
  },
  { id: TransparencyBlock.GrateSolid, name: "GrateSolid", shapeId: "cube", paint: paintGrate }
];

export interface TransparencyTileset {
  definition: TilesetDefinition;
  blocks: BlockDefinition[];
}

/**
 * Builds the diorama's tileset in memory: one painted tile per block, handed
 * over as a data URL. The atlas is RGBA, so cutout tiles carry real holes.
 */
export function createTransparencyTileset(
  id = "transparency"
): TransparencyTileset {
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
  spec: BlockSpec,
  index: number
): BlockDefinition {
  return {
    id: spec.id,
    name: spec.name,
    shapeId: spec.shapeId,
    collidable: spec.collidable ?? true,
    transparent: spec.transparent ?? false,
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
    throw new Error("transparencyAtlas: unable to acquire a 2D canvas context");
  }

  for (const [index, { paint }] of kBlockSpecs.entries()) {
    context.save();
    context.translate((index % kCols) * kTileSize, Math.floor(index / kCols) * kTileSize);
    paint(context, kTileSize);
    context.restore();
  }

  return canvas;
}
