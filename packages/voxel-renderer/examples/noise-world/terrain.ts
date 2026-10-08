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
const kFrequency = 1 / 256;
const kAmplitude = 56;
const kWaterLevel = 24;
const kSnowLevel = 64;
const kSoilDepth = 4;
const kTreeDensity = 0.03;
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
  grove: 6,
  patches: 7
} as const;
const kPatchFrequency = kFrequency * 16;
const kSnowJitter = 3;
const kBeachPatch = 0.35;
const kBeachReach = 3;
const kDirtPatch = -0.45;

export interface TerrainOptions {
  seed: number;
  size: number;
}

interface Column {
  x: number;
  z: number;
  height: number;
  floor: number;
  surface: TerrainBlockId;
}

export function generateTerrain(
  write: TerrainWriter,
  options: TerrainOptions
): number {
  const { seed, size } = options;

  const heightmap = new Heightmap(seed, size);
  const patches = createNoiseLayer(seed, kNoiseSalt.patches);
  const forest = createNoiseLayer(seed, kNoiseSalt.forest);
  const grove = createNoiseLayer(seed, kNoiseSalt.grove);
  let treeCount = 0;

  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const height = heightmap.heightAt(x, z);
      const lowest = heightmap.lowestNeighbour(x, z);
      const surface = surfaceBlockAt(
        height,
        height - lowest >= kCliffHeight,
        patches.sample(x * kPatchFrequency, z * kPatchFrequency)
      );
      fillColumn(write, {
        x,
        z,
        height,
        floor: Math.max(0, lowest - 1),
        surface
      });

      if (height < kWaterLevel) {
        write({ x, y: kWaterLevel, z }, TerrainBlock.Water);
        continue;
      }

      const isForest = forest.sample(x * kFrequency * 4, z * kFrequency * 4) > 0.1;
      const density = isForest ? kTreeDensity : kTreeDensity / 4;
      const chance = hash2D(x, z, seed);
      const canGrowTree = surface === TerrainBlock.Grass &&
        height > kWaterLevel + 2 &&
        heightmap.isInterior(x, z, TREE_MAX_RADIUS);
      if (chance < density && canGrowTree) {
        const species = chooseSpecies(
          height,
          isForest ? grove.sample(x * kFrequency * 3, z * kFrequency * 3) : null,
          chance / density
        );
        plantTree(write, species, { x, y: height + 1, z }, seed);
        treeCount++;
      }
    }
  }

  return treeCount;
}

class Heightmap {
  readonly size: number;
  readonly #heights: Int16Array;

  constructor(
    seed: number,
    size: number
  ) {
    this.size = size;
    this.#heights = computeHeights(seed, size);
  }

  heightAt(
    x: number,
    z: number
  ): number {
    return this.#heights[(z * this.size) + x];
  }

  lowestNeighbour(
    x: number,
    z: number
  ): number {
    let lowest = this.heightAt(x, z);
    if (x > 0) {
      lowest = Math.min(lowest, this.heightAt(x - 1, z));
    }
    if (x < this.size - 1) {
      lowest = Math.min(lowest, this.heightAt(x + 1, z));
    }
    if (z > 0) {
      lowest = Math.min(lowest, this.heightAt(x, z - 1));
    }
    if (z < this.size - 1) {
      lowest = Math.min(lowest, this.heightAt(x, z + 1));
    }

    return lowest;
  }

  isInterior(
    x: number,
    z: number,
    margin: number
  ): boolean {
    const end = this.size - margin;

    return x >= margin && x < end && z >= margin && z < end;
  }
}

function surfaceBlockAt(
  height: number,
  isCliff: boolean,
  patch: number
): TerrainBlockId {
  if (height >= kSnowLevel + Math.round(patch * kSnowJitter)) {
    return TerrainBlock.Snow;
  }
  if (isCliff) {
    return TerrainBlock.Stone;
  }
  if (
    height <= kWaterLevel + 1 ||
    (height <= kWaterLevel + kBeachReach && patch > kBeachPatch)
  ) {
    return TerrainBlock.Sand;
  }

  return patch < kDirtPatch ? TerrainBlock.Dirt : TerrainBlock.Grass;
}

function computeHeights(
  seed: number,
  size: number
): Int16Array {
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
      column[0] = x * kFrequency;
      column[1] = z * kFrequency;
      domainWarp2(point, warp.sample, column[0], column[1], kWarpAmount);

      const continentalness = fbm(continentOctave, 5, 2, 0.5);
      const mountains = fade(
        remapClamp(continentalness, kMountainRange[0], kMountainRange[1], 0, 1)
      );
      const crest = remapClamp(ridged(ridgeOctave, 5, 2, 0.5), 0.45, 1, 0, 1) ** 1.3;
      const hill = fbm(hillOctave, 3, 2, 0.5) * lerp(2, 6, mountains);

      heights[(z * size) + x] = Math.max(1, Math.round(
        kWaterLevel +
        continentHeight(continentalness) +
        (mountains * crest * kAmplitude) +
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
  write: TerrainWriter,
  column: Column
): void {
  const { x, z, height, floor, surface } = column;
  const soil = surface === TerrainBlock.Sand ? TerrainBlock.Sand : TerrainBlock.Dirt;

  for (let y = floor; y <= height; y++) {
    let blockId: TerrainBlockId = TerrainBlock.Stone;
    if (y === height) {
      blockId = surface;
    }
    else if (y > height - kSoilDepth && surface !== TerrainBlock.Stone) {
      blockId = soil;
    }

    write({ x, y, z }, blockId);
  }
}

function chooseSpecies(
  height: number,
  grove: number | null,
  pick: number
): TreeSpecies {
  if (height >= kSnowLevel - kPineLine) {
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
