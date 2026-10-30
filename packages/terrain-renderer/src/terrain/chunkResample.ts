// Import Internal Dependencies
import type { ChunkCoord } from "./ChunkCoord.ts";
import {
  chunkResolution,
  type ChunkTier
} from "./chunkTier.ts";
import {
  holeBytes,
  type HoleMask
} from "./HoleMask.ts";
import { quadDiagonal } from "./quadDiagonal.ts";
import type { TerrainReader } from "./Terrain.ts";

type GridHeight = (gridX: number, gridZ: number) => number;

export function resampleHeights(
  terrain: Pick<TerrainReader, "chunk" | "sampleAt">,
  coord: ChunkCoord,
  tier: ChunkTier
): Float32Array {
  const chunk = terrain.chunk(coord);
  if (chunk === undefined) {
    throw new Error(`Chunk ${coord.key} is not loaded.`);
  }

  if (tier <= chunk.tier) {
    const step = chunk.tier / tier;
    const resolution = chunkResolution(tier);
    const heights = new Float32Array(resolution * resolution);
    for (let gridZ = 0; gridZ < resolution; gridZ++) {
      for (let gridX = 0; gridX < resolution; gridX++) {
        heights[gridZ * resolution + gridX] = chunk.sample(gridX * step, gridZ * step);
      }
    }

    return heights;
  }

  const origin = coord.originSample;
  let current = chunk.tier;
  let heights = chunk.copyHeights();
  while (current < tier) {
    const resolution = chunkResolution(current as ChunkTier);
    const source = heights;
    const spacing = 1 / current;
    heights = doubleGrid(resolution, (gridX, gridZ) => (gridX < resolution && gridZ < resolution ?
      source[gridZ * resolution + gridX] :
      beyondHeight(terrain, origin.x + gridX * spacing, origin.z + gridZ * spacing)));
    current *= 2;
  }

  return heights;
}

export function resampleHoles(
  holes: HoleMask,
  tier: ChunkTier
): Uint8Array {
  const target = new Uint8Array(holeBytes(tier));
  const quads = chunkResolution(tier);
  const ratio = holes.tier / tier;
  const span = Math.max(ratio, 1);
  for (let quadZ = 0; quadZ < quads; quadZ++) {
    for (let quadX = 0; quadX < quads; quadX++) {
      if (anyHole(holes, Math.floor(quadX * ratio), Math.floor(quadZ * ratio), span)) {
        const index = quadZ * quads + quadX;
        target[index >> 3] |= 1 << (index & 7);
      }
    }
  }

  return target;
}

function doubleGrid(
  resolution: number,
  source: GridHeight
): Float32Array {
  const fine = resolution * 2;
  const heights = new Float32Array(fine * fine);
  for (let fineZ = 0; fineZ < fine; fineZ++) {
    for (let fineX = 0; fineX < fine; fineX++) {
      heights[fineZ * fine + fineX] = midpointHeight(source, fineX, fineZ);
    }
  }

  return heights;
}

function midpointHeight(
  source: GridHeight,
  fineX: number,
  fineZ: number
): number {
  const x = fineX >> 1;
  const z = fineZ >> 1;
  const oddX = (fineX & 1) === 1;
  const oddZ = (fineZ & 1) === 1;
  if (!oddX && !oddZ) {
    return source(x, z);
  }
  if (oddX && !oddZ) {
    return (source(x, z) + source(x + 1, z)) / 2;
  }
  if (!oddX && oddZ) {
    return (source(x, z) + source(x, z + 1)) / 2;
  }

  return quadDiagonal(x, z) === "main" ?
    (source(x, z) + source(x + 1, z + 1)) / 2 :
    (source(x + 1, z) + source(x, z + 1)) / 2;
}

function beyondHeight(
  terrain: Pick<TerrainReader, "sampleAt">,
  x: number,
  z: number
): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = x - x0;
  const fz = z - z0;
  const near = terrain.sampleAt(x0, z0) * (1 - fx) + terrain.sampleAt(x0 + 1, z0) * fx;
  const far = terrain.sampleAt(x0, z0 + 1) * (1 - fx) + terrain.sampleAt(x0 + 1, z0 + 1) * fx;

  return near * (1 - fz) + far * fz;
}

function anyHole(
  holes: HoleMask,
  quadX: number,
  quadZ: number,
  span: number
): boolean {
  for (let dz = 0; dz < span; dz++) {
    for (let dx = 0; dx < span; dx++) {
      if (holes.isHole(quadX + dx, quadZ + dz)) {
        return true;
      }
    }
  }

  return false;
}
