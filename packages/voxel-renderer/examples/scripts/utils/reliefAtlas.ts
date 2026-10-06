// Import Internal Dependencies
import type {
  BlockDefinition,
  BlocksetDefinition
} from "../../../src/index.ts";

// CONSTANTS
const kTileSize = 16;
const kRows = 2;
const kNormalStrength = 4;

export const RELIEF_GROUP = "relief";

export const ReliefBlock = {
  Bricks: 1,
  Planks: 2,
  Cobble: 3,
  Studs: 4,
  BrickRamp: 5,
  PlankStair: 6,
  CobbleSlab: 7,
  StudPole: 8
} as const;

type Rgb = readonly [number, number, number];

type HeightFn = (
  x: number,
  y: number
) => number;

interface ReliefTile {
  height: HeightFn;
  low: Rgb;
  high: Rgb;
}

interface ReliefBlockSpec {
  id: number;
  name: string;
  shapeId: BlockDefinition["shapeId"];
  col: number;
}

export interface ReliefBlockset {
  definition: BlocksetDefinition;
  albedoSrc: string;
  normalSrc: string;
  blocks: BlockDefinition[];
}

const kTiles: ReliefTile[] = [
  {
    height: bricks,
    low: [92, 78, 70],
    high: [178, 84, 62]
  },
  {
    height: planks,
    low: [70, 46, 26],
    high: [190, 136, 82]
  },
  {
    height: cobble,
    low: [58, 60, 66],
    high: [168, 168, 160]
  },
  {
    height: studs,
    low: [40, 70, 120],
    high: [110, 170, 230]
  }
];

const kBlocks: ReliefBlockSpec[] = [
  { id: ReliefBlock.Bricks, name: "Bricks", shapeId: "cube", col: 0 },
  { id: ReliefBlock.Planks, name: "Planks", shapeId: "cube", col: 1 },
  { id: ReliefBlock.Cobble, name: "Cobble", shapeId: "cube", col: 2 },
  { id: ReliefBlock.Studs, name: "Studs", shapeId: "cube", col: 3 },
  { id: ReliefBlock.BrickRamp, name: "BrickRamp", shapeId: "ramp", col: 0 },
  { id: ReliefBlock.PlankStair, name: "PlankStair", shapeId: "stair", col: 1 },
  { id: ReliefBlock.CobbleSlab, name: "CobbleSlab", shapeId: "slabBottom", col: 2 },
  { id: ReliefBlock.StudPole, name: "StudPole", shapeId: "poleY", col: 3 }
];

export function createReliefBlockset(
  id = "relief"
): ReliefBlockset {
  const width = kTiles.length * kTileSize;
  const height = kRows * kTileSize;
  const albedo = new ImageData(width, height);
  const normal = new ImageData(width, height);

  for (const [col, tile] of kTiles.entries()) {
    const heights = sampleHeights(tile.height);
    for (let row = 0; row < kRows; row++) {
      paintTile(albedo, normal, heights, {
        tile,
        originX: col * kTileSize,
        originY: row * kTileSize
      });
    }
  }

  return {
    definition: {
      id,
      tileSize: kTileSize,
      cols: kTiles.length,
      rows: kRows
    },
    albedoSrc: toDataUrl(albedo),
    normalSrc: toDataUrl(normal),
    blocks: kBlocks.map((spec) => {
      return {
        id: spec.id,
        name: spec.name,
        shapeId: spec.shapeId,
        materialGroup: RELIEF_GROUP,
        faceTextures: {},
        defaultTexture: {
          col: spec.col,
          row: 0
        }
      };
    })
  };
}

interface TilePlacement {
  tile: ReliefTile;
  originX: number;
  originY: number;
}

function paintTile(
  albedo: ImageData,
  normal: ImageData,
  heights: Float32Array,
  placement: TilePlacement
): void {
  const { tile, originX, originY } = placement;

  for (let y = 0; y < kTileSize; y++) {
    for (let x = 0; x < kTileSize; x++) {
      const h = heights[(y * kTileSize) + x];
      const offset = (((originY + y) * albedo.width) + originX + x) * 4;
      const grain = 0.9 + (noise(x, y) * 0.2);
      for (let channel = 0; channel < 3; channel++) {
        const color = tile.low[channel] +
          ((tile.high[channel] - tile.low[channel]) * h);
        albedo.data[offset + channel] = color * grain;
      }
      albedo.data[offset + 3] = 255;

      const dx = (heightAt(heights, x + 1, y) - heightAt(heights, x - 1, y)) *
        kNormalStrength;
      const dy = (heightAt(heights, x, y + 1) - heightAt(heights, x, y - 1)) *
        kNormalStrength;
      const length = Math.hypot(dx, dy, 1);
      normal.data[offset] = Math.round(((-dx / length) * 0.5 + 0.5) * 255);
      normal.data[offset + 1] = Math.round(((dy / length) * 0.5 + 0.5) * 255);
      normal.data[offset + 2] = Math.round(((1 / length) * 0.5 + 0.5) * 255);
      normal.data[offset + 3] = 255;
    }
  }
}

function sampleHeights(
  height: HeightFn
): Float32Array {
  const heights = new Float32Array(kTileSize * kTileSize);
  for (let y = 0; y < kTileSize; y++) {
    for (let x = 0; x < kTileSize; x++) {
      heights[(y * kTileSize) + x] = height(x, y);
    }
  }

  return heights;
}

function heightAt(
  heights: Float32Array,
  x: number,
  y: number
): number {
  const wrappedX = (x + kTileSize) % kTileSize;
  const wrappedY = (y + kTileSize) % kTileSize;

  return heights[(wrappedY * kTileSize) + wrappedX];
}

function bricks(
  x: number,
  y: number
): number {
  const course = Math.floor(y / 4);
  const shifted = (x + (course % 2 === 0 ? 0 : 4)) % kTileSize;
  const edgeX = Math.min(shifted % 8, 7 - (shifted % 8));
  const edgeY = Math.min(y % 4, 3 - (y % 4));
  if (shifted % 8 === 7 || y % 4 === 3) {
    return 0.1;
  }

  return Math.min(1, 0.55 + (0.25 * Math.min(edgeX, edgeY))) -
    (noise(x, y) * 0.1);
}

function planks(
  x: number,
  y: number
): number {
  if (y % 4 === 3) {
    return 0.05;
  }

  const board = Math.floor(y / 4);
  const grain = Math.sin((x * 0.9) + (board * 2.3) + (y * 0.4)) * 0.12;

  return 0.75 + grain - (noise(x, board) * 0.1);
}

function cobble(
  x: number,
  y: number
): number {
  const distances: number[] = [];
  for (let index = 0; index < 6; index++) {
    const seedX = noise(index, 3) * kTileSize;
    const seedY = noise(7, index) * kTileSize;
    const dx = wrappedDistance(x + 0.5, seedX);
    const dy = wrappedDistance(y + 0.5, seedY);
    distances.push(Math.hypot(dx, dy));
  }
  distances.sort((a, b) => a - b);
  const [nearest, second] = distances;

  return Math.min(1, Math.max(0, (second - nearest) / 3.5)) *
    (0.85 + (noise(x, y) * 0.15));
}

function studs(
  x: number,
  y: number
): number {
  const cellX = (x % 8) - 3.5;
  const cellY = (y % 8) - 3.5;
  const radius = Math.hypot(cellX, cellY) / 3;

  return radius >= 1 ? 0.15 : 0.15 + (Math.sqrt(1 - (radius * radius)) * 0.85);
}

function wrappedDistance(
  a: number,
  b: number
): number {
  const distance = Math.abs(a - b);

  return Math.min(distance, kTileSize - distance);
}

function noise(
  x: number,
  y: number
): number {
  const n = Math.sin((x * 127.1) + (y * 311.7)) * 43758.5453;

  return n - Math.floor(n);
}

function toDataUrl(
  image: ImageData
): string {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("reliefAtlas: unable to acquire a 2D canvas context");
  }
  context.putImageData(image, 0, 0);

  return canvas.toDataURL("image/png");
}
