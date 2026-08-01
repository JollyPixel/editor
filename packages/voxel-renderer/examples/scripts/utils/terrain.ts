// Import Internal Dependencies
import {
  createFractalNoise2D,
  hash2D
} from "./noise.ts";

// CONSTANTS
// Leaves reach two voxels away from the trunk; keep whole trees inside the world.
const kTreeMargin = 2;
const kMinTrunkHeight = 4;
const kMaxTrunkHeight = 6;
// Pushes the noise histogram towards the low end so plains dominate and peaks
// stay rare, instead of the uniformly bumpy terrain raw fBm produces.
const kHeightExponent = 1.7;

/**
 * Block ids used by the generator. They match the definitions returned by
 * `createTerrainBlocks()` in `terrainAtlas.ts`.
 */
export const TerrainBlock = {
  Grass: 1,
  Dirt: 2,
  Stone: 3,
  Sand: 4,
  Snow: 5,
  Water: 6,
  Log: 7,
  Leaves: 8
} as const;
export type TerrainBlockId = typeof TerrainBlock[keyof typeof TerrainBlock];

export interface TerrainPosition {
  x: number;
  y: number;
  z: number;
}

/**
 * Receives every generated voxel. The position object is freshly allocated per
 * voxel and never reused, so it can be handed straight to `setVoxel`.
 */
export type TerrainWriter = (
  position: TerrainPosition,
  blockId: TerrainBlockId
) => void;

export interface TerrainOptions {
  /**
   * @default 1337
   */
  seed?: number;
  /**
   * World width and depth in voxels. The generated column count is `size²`.
   * @default 256
   */
  size?: number;
  /**
   * Noise frequency per voxel — lower values stretch hills and valleys wider.
   * Independent of `size`, so a bigger world means more features, not bigger ones.
   * @default 1 / 96
   */
  frequency?: number;
  /**
   * Height of the lowest possible column.
   * @default 4
   */
  baseHeight?: number;
  /**
   * Vertical range added on top of `baseHeight`.
   * @default 28
   */
  amplitude?: number;
  /**
   * Columns below this level get a water surface; those barely above get sand.
   * @default 11
   */
  waterLevel?: number;
  /**
   * Columns at or above this level get a snow surface.
   * @default 28
   */
  snowLevel?: number;
  /**
   * Dirt/sand voxels emitted under the surface before switching to stone.
   * @default 4
   */
  soilDepth?: number;
  /**
   * Probability that any eligible grass column grows a tree.
   * @default 0.008
   */
  treeDensity?: number;
}

export interface TerrainStats {
  /** Total voxels written, water and trees included. */
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

/**
 * Generates a Minecraft-like heightmap world and streams it to `write`.
 *
 * Only the visible shell is emitted: a column stops one voxel below its lowest
 * neighbour, so cliffs stay solid while the interior of the terrain is left
 * empty. That keeps the voxel count proportional to the surface area rather
 * than the volume — the whole point of benchmarking a *big* world.
 */
export function generateTerrain(
  write: TerrainWriter,
  options: TerrainOptions = {}
): TerrainStats {
  const {
    seed = 1337,
    size = 256,
    frequency = 1 / 96,
    baseHeight = 4,
    amplitude = 28,
    waterLevel = 11,
    snowLevel = 28,
    soilDepth = 4,
    treeDensity = 0.008
  } = options;

  const heights = computeHeightmap({ seed, size, frequency, baseHeight, amplitude });
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

      if (canGrowTree(context, x, z) && hash2D(x, z, seed) < treeDensity) {
        stats.voxelCount += plantTree(write, { x, y: height + 1, z }, seed);
        stats.treeCount++;
      }
    }
  }

  return stats;
}

/**
 * Surface material for a column, purely a function of its height.
 */
export function surfaceBlockAt(
  height: number,
  waterLevel: number,
  snowLevel: number
): TerrainBlockId {
  if (height <= waterLevel + 1) {
    return TerrainBlock.Sand;
  }

  return height >= snowLevel ? TerrainBlock.Snow : TerrainBlock.Grass;
}

type HeightmapOptions = Required<
  Pick<TerrainOptions, "seed" | "size" | "frequency" | "baseHeight" | "amplitude">
>;

function computeHeightmap(
  options: HeightmapOptions
): Int16Array {
  const { seed, size, frequency, baseHeight, amplitude } = options;

  const noise = createFractalNoise2D(seed, { frequency, octaves: 5 });
  const heights = new Int16Array(size * size);

  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      // fBm is signed; remap to [0, 1] before shaping the distribution.
      const raw = (noise(x, z) * 0.5) + 0.5;
      heights[(z * size) + x] = Math.round(
        baseHeight + (raw ** kHeightExponent * amplitude)
      );
    }
  }

  return heights;
}

/**
 * Writes one column from its shell floor up to its surface and returns how
 * many voxels were emitted.
 */
function fillColumn(
  context: ColumnContext,
  x: number,
  z: number
): number {
  const { write, waterLevel, snowLevel, soilDepth } = context;

  const height = heightAt(context, x, z);
  const surface = surfaceBlockAt(height, waterLevel, snowLevel);
  const soil = surface === TerrainBlock.Sand ? TerrainBlock.Sand : TerrainBlock.Dirt;
  const floor = Math.max(0, lowestNeighbour(context, x, z) - 1);

  for (let y = floor; y <= height; y++) {
    let blockId: TerrainBlockId = TerrainBlock.Stone;
    if (y === height) {
      blockId = surface;
    }
    else if (y > height - soilDepth) {
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

/**
 * Lowest of the four orthogonal neighbours, clamped to the column itself at
 * the world border (nothing is visible from outside the world edge).
 */
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
    x < kTreeMargin || x >= size - kTreeMargin ||
    z < kTreeMargin || z >= size - kTreeMargin
  ) {
    return false;
  }

  const height = heightAt(context, x, z);

  return height > waterLevel + 2 &&
    surfaceBlockAt(height, waterLevel, snowLevel) === TerrainBlock.Grass;
}

/**
 * Trunk plus a four-layer canopy. Overlapping canopies simply overwrite each
 * other, so no spacing check is needed.
 */
function plantTree(
  write: TerrainWriter,
  origin: { x: number; y: number; z: number; },
  seed: number
): number {
  const { x, y, z } = origin;
  const spread = kMaxTrunkHeight - kMinTrunkHeight + 1;
  const trunkHeight = kMinTrunkHeight + Math.floor(hash2D(x, z, seed + 1) * spread);

  let written = 0;
  for (let i = 0; i < trunkHeight; i++) {
    write({ x, y: y + i, z }, TerrainBlock.Log);
    written++;
  }

  const topY = y + trunkHeight - 1;
  for (let dy = -2; dy <= 1; dy++) {
    const radius = dy < 0 ? 2 : 1;

    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const isClippedCorner = radius === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2;
        const isTrunk = dx === 0 && dz === 0 && dy < 1;
        if (isClippedCorner || isTrunk) {
          continue;
        }

        write({ x: x + dx, y: topY + dy, z: z + dz }, TerrainBlock.Leaves);
        written++;
      }
    }
  }

  return written;
}
