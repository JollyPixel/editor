// Import Third-party Dependencies
import {
  fade,
  lerp,
  remapClamp,
  type Vec2
} from "math";
import {
  domainWarp2,
  fbm,
  ridged
} from "math/noise";

// Import Internal Dependencies
import {
  TerrainBlock,
  type TerrainBlockId,
  type TerrainWriter
} from "./blocks.ts";
import {
  createNoiseLayer,
  hash2D
} from "./noise.ts";
import {
  TREE_MAX_RADIUS,
  plantTree,
  type TreeSpecies
} from "./trees.ts";

// CONSTANTS
const kPineLine = 20;
const kCliffHeight = 3;
const kContinentSpline: ReadonlyArray<readonly [number, number]> = [
  [-1, -18],
  [-0.5, -10],
  [-0.25, -2],
  [-0.18, 1],
  [0, 4],
  [0.2, 7],
  [0.4, 14],
  [1, 24]
];
const kMountainRange = [0.05, 0.3] as const;
const kWarpAmount = 0.15;
const kNoiseSalt = {
  continent: 1,
  ridges: 2,
  hills: 3,
  warp: 4,
  forest: 5,
  grove: 6
} as const;

export interface TerrainOptions {
  seed?: number;
  size?: number;
  frequency?: number;
  amplitude?: number;
  waterLevel?: number;
  snowLevel?: number;
  soilDepth?: number;
  treeDensity?: number;
}

export interface TerrainStats {
  voxelCount: number;
  waterCount: number;
  treeCount: number;
  columnCount: number;
  minHeight: number;
  maxHeight: number;
}

interface ColumnContext {
  write: TerrainWriter;
  heights: Int16Array;
  size: number;
  waterLevel: number;
  snowLevel: number;
  soilDepth: number;
}

export function generateTerrain(
  write: TerrainWriter,
  options: TerrainOptions = {}
): TerrainStats {
  const {
    seed = 1337,
    size = 512,
    frequency = 1 / 256,
    amplitude = 56,
    waterLevel = 24,
    snowLevel = 64,
    soilDepth = 4,
    treeDensity = 0.03
  } = options;

  const heights = computeHeightmap({
    seed,
    size,
    frequency,
    amplitude,
    waterLevel
  });
  const forest = createNoiseLayer(seed, kNoiseSalt.forest);
  const grove = createNoiseLayer(seed, kNoiseSalt.grove);
  const context: ColumnContext = {
    write,
    heights,
    size,
    waterLevel,
    snowLevel,
    soilDepth
  };

  const stats: TerrainStats = {
    voxelCount: 0,
    waterCount: 0,
    treeCount: 0,
    columnCount: size * size,
    minHeight: Infinity,
    maxHeight: -Infinity
  };

  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const height = heights[(z * size) + x];
      stats.minHeight = Math.min(stats.minHeight, height);
      stats.maxHeight = Math.max(stats.maxHeight, height);

      stats.voxelCount += fillColumn(context, x, z);

      if (height < waterLevel) {
        write({ x, y: waterLevel, z }, TerrainBlock.Water);
        stats.voxelCount++;
        stats.waterCount++;
        continue;
      }

      const isForest = forest.sample(x * frequency * 4, z * frequency * 4) > 0.1;
      const density = isForest ? treeDensity : treeDensity / 4;
      const chance = hash2D(x, z, seed);
      if (chance < density && canGrowTree(context, x, z)) {
        const species = chooseSpecies(
          context,
          height,
          isForest ? grove.sample(x * frequency * 3, z * frequency * 3) : null,
          chance / density
        );
        stats.voxelCount += plantTree(write, species, { x, y: height + 1, z }, seed);
        stats.treeCount++;
      }
    }
  }

  return stats;
}

export function surfaceBlockAt(
  height: number,
  waterLevel: number,
  snowLevel: number,
  isCliff = false
): TerrainBlockId {
  if (height >= snowLevel) {
    return TerrainBlock.Snow;
  }
  if (isCliff) {
    return TerrainBlock.Stone;
  }

  return height <= waterLevel + 1 ? TerrainBlock.Sand : TerrainBlock.Grass;
}

type HeightmapOptions = Required<
  Pick<
    TerrainOptions,
    "seed" | "size" | "frequency" | "amplitude" | "waterLevel"
  >
>;

function computeHeightmap(
  options: HeightmapOptions
): Int16Array {
  const { seed, size, frequency, amplitude, waterLevel } = options;

  const continent = createNoiseLayer(seed, kNoiseSalt.continent);
  const ridges = createNoiseLayer(seed, kNoiseSalt.ridges);
  const hills = createNoiseLayer(seed, kNoiseSalt.hills);
  const warp = createNoiseLayer(seed, kNoiseSalt.warp);

  const column: Vec2 = [0, 0];
  const point: Vec2 = [0, 0];
  function continentOctave(
    octave: number
  ): number {
    return continent.sample(point[0] * 0.8 * octave, point[1] * 0.8 * octave);
  }
  function ridgeOctave(
    octave: number
  ): number {
    return ridges.sample(point[0] * 1.5 * octave, point[1] * 1.5 * octave);
  }
  function hillOctave(
    octave: number
  ): number {
    return hills.sample(column[0] * 6 * octave, column[1] * 6 * octave);
  }

  const heights = new Int16Array(size * size);
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      column[0] = x * frequency;
      column[1] = z * frequency;
      domainWarp2(point, warp.sample, column[0], column[1], kWarpAmount);

      const continentalness = fbm(continentOctave, 5, 2, 0.5);
      const mountains = fade(
        remapClamp(continentalness, kMountainRange[0], kMountainRange[1], 0, 1)
      );
      const crest = remapClamp(ridged(ridgeOctave, 5, 2, 0.5), 0.45, 1, 0, 1) ** 1.3;
      const hill = fbm(hillOctave, 3, 2, 0.5) * lerp(2, 6, mountains);

      heights[(z * size) + x] = Math.max(1, Math.round(
        waterLevel +
        continentHeight(continentalness) +
        (mountains * crest * amplitude) +
        hill
      ));
    }
  }

  return heights;
}

function continentHeight(
  continentalness: number
): number {
  for (let i = 1; i < kContinentSpline.length; i++) {
    const [x1, y1] = kContinentSpline[i];
    if (continentalness <= x1) {
      const [x0, y0] = kContinentSpline[i - 1];

      return remapClamp(continentalness, x0, x1, y0, y1);
    }
  }

  return kContinentSpline[kContinentSpline.length - 1][1];
}

function fillColumn(
  context: ColumnContext,
  x: number,
  z: number
): number {
  const { write, waterLevel, snowLevel, soilDepth } = context;

  const height = heightAt(context, x, z);
  const lowest = lowestNeighbour(context, x, z);
  const surface = surfaceBlockAt(
    height,
    waterLevel,
    snowLevel,
    height - lowest >= kCliffHeight
  );
  const soil = surface === TerrainBlock.Sand ? TerrainBlock.Sand : TerrainBlock.Dirt;
  const floor = Math.max(0, lowest - 1);

  for (let y = floor; y <= height; y++) {
    let blockId: TerrainBlockId = TerrainBlock.Stone;
    if (y === height) {
      blockId = surface;
    }
    else if (y > height - soilDepth && surface !== TerrainBlock.Stone) {
      blockId = soil;
    }

    write({ x, y, z }, blockId);
  }

  return height - floor + 1;
}

function heightAt(
  context: ColumnContext,
  x: number,
  z: number
): number {
  return context.heights[(z * context.size) + x];
}

function lowestNeighbour(
  context: ColumnContext,
  x: number,
  z: number
): number {
  const { size } = context;
  let lowest = heightAt(context, x, z);

  if (x > 0) {
    lowest = Math.min(lowest, heightAt(context, x - 1, z));
  }
  if (x < size - 1) {
    lowest = Math.min(lowest, heightAt(context, x + 1, z));
  }
  if (z > 0) {
    lowest = Math.min(lowest, heightAt(context, x, z - 1));
  }
  if (z < size - 1) {
    lowest = Math.min(lowest, heightAt(context, x, z + 1));
  }

  return lowest;
}

function canGrowTree(
  context: ColumnContext,
  x: number,
  z: number
): boolean {
  const { size, waterLevel, snowLevel } = context;
  if (
    x < TREE_MAX_RADIUS || x >= size - TREE_MAX_RADIUS ||
    z < TREE_MAX_RADIUS || z >= size - TREE_MAX_RADIUS
  ) {
    return false;
  }

  const height = heightAt(context, x, z);
  const isCliff = height - lowestNeighbour(context, x, z) >= kCliffHeight;

  return height > waterLevel + 2 &&
    surfaceBlockAt(height, waterLevel, snowLevel, isCliff) === TerrainBlock.Grass;
}

function chooseSpecies(
  context: ColumnContext,
  height: number,
  grove: number | null,
  pick: number
): TreeSpecies {
  if (height >= context.snowLevel - kPineLine) {
    return "pine";
  }
  if (grove === null) {
    return pick < 0.7 ? "bush" : "oak";
  }
  if (grove > 0.2) {
    return "birch";
  }

  return pick < 0.15 ? "pine" : "oak";
}
