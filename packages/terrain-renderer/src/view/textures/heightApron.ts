// Import Internal Dependencies
import {
  CHUNK_SAMPLES,
  ChunkCoord,
  type ChunkKey
} from "../../terrain/ChunkCoord.ts";
import {
  chunkResolution,
  type ChunkTier
} from "../../terrain/chunkTier.ts";
import {
  BORDER_SAMPLES,
  type SampleBlock
} from "../../terrain/SampleBlock.ts";
import type { TerrainReader } from "../../terrain/Terrain.ts";

// CONSTANTS
export const APRON_MARGIN = BORDER_SAMPLES;
export const APRON_SIZE = CHUNK_SAMPLES + APRON_MARGIN * 2;
export const APRON_TEXELS = APRON_SIZE * APRON_SIZE;

export interface SampleRect {
  /**
   * Local sample X and Z of the rectangle's corner; the apron spans
   * `-APRON_MARGIN` to `CHUNK_SAMPLES + APRON_MARGIN - 1`.
   */
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
}

export interface ApronRegion {
  readonly coord: ChunkCoord;
  readonly samples: SampleRect;
}

export const CHUNK_RECT: SampleRect = {
  x: 0,
  z: 0,
  width: CHUNK_SAMPLES,
  depth: CHUNK_SAMPLES
};
export const APRON_RECT: SampleRect = {
  x: -APRON_MARGIN,
  z: -APRON_MARGIN,
  width: APRON_SIZE,
  depth: APRON_SIZE
};

export function* affectedAprons(
  coord: ChunkCoord,
  changed: SampleRect
): IterableIterator<ApronRegion> {
  const reach = {
    x: changed.x - APRON_MARGIN,
    z: changed.z - APRON_MARGIN,
    width: changed.width + APRON_MARGIN * 2,
    depth: changed.depth + APRON_MARGIN * 2
  };
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const reached = intersect(
        {
          ...reach,
          x: reach.x - dx * CHUNK_SAMPLES,
          z: reach.z - dz * CHUNK_SAMPLES
        },
        APRON_RECT
      );
      if (reached !== null) {
        yield {
          coord: new ChunkCoord(coord.x + dx, coord.z + dz),
          samples: reached
        };
      }
    }
  }
}

export function mergeAprons(
  regions: Iterable<ApronRegion>
): IterableIterator<ApronRegion> {
  const merged = new Map<ChunkKey, ApronRegion>();
  for (const region of regions) {
    const previous = merged.get(region.coord.key);
    merged.set(region.coord.key, previous === undefined ? region : {
      coord: region.coord,
      samples: boundingRect(previous.samples, region.samples)
    });
  }

  return merged.values();
}

export function writeApron(
  terrain: TerrainReader,
  coord: ChunkCoord,
  apron: Float32Array,
  samples: SampleRect
): void {
  const origin = coord.originSample;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const block = intersect(samples, {
        x: dx * CHUNK_SAMPLES,
        z: dz * CHUNK_SAMPLES,
        width: CHUNK_SAMPLES,
        depth: CHUNK_SAMPLES
      });
      if (block === null) {
        continue;
      }

      const source = apronSource(terrain, new ChunkCoord(coord.x + dx, coord.z + dz));
      for (let localZ = block.z; localZ < block.z + block.depth; localZ++) {
        const row = (localZ + APRON_MARGIN) * APRON_SIZE + APRON_MARGIN;
        for (let localX = block.x; localX < block.x + block.width; localX++) {
          apron[row + localX] = source.height(origin.x + localX, origin.z + localZ);
        }
      }
    }
  }
}

export function apronSize(
  tier: ChunkTier
): number {
  return chunkResolution(tier) + APRON_MARGIN * 2;
}

export function writeFineApron(
  terrain: TerrainReader,
  coord: ChunkCoord,
  apron: Float32Array
): void {
  const chunk = terrain.chunk(coord);
  if (chunk === undefined) {
    return;
  }

  const { tier, resolution } = chunk;
  const size = apronSize(tier);
  const origin = coord.originSample;
  for (let gridZ = -APRON_MARGIN; gridZ < resolution + APRON_MARGIN; gridZ++) {
    const row = (gridZ + APRON_MARGIN) * size + APRON_MARGIN;
    for (let gridX = -APRON_MARGIN; gridX < resolution + APRON_MARGIN; gridX++) {
      apron[row + gridX] = gridX >= 0 && gridZ >= 0 && gridX < resolution && gridZ < resolution ?
        chunk.sample(gridX, gridZ) :
        fineHeight(terrain, origin.x + gridX / tier, origin.z + gridZ / tier);
    }
  }
}

export function fineHeight(
  terrain: TerrainReader,
  x: number,
  z: number
): number {
  const coord = ChunkCoord.containing(x, z);
  const chunk = terrain.chunk(coord);
  if (chunk === undefined) {
    return terrain.knows(coord) ?
      terrain.overview.interpolate(x, z) ?? terrain.sampleAt(Math.round(x), Math.round(z)) :
      terrain.sampleAt(Math.round(x), Math.round(z));
  }

  const { tier, resolution } = chunk;
  const origin = coord.originSample;
  const gridX = (x - origin.x) * tier;
  const gridZ = (z - origin.z) * tier;
  const x0 = Math.floor(gridX);
  const z0 = Math.floor(gridZ);
  const fx = gridX - x0;
  const fz = gridZ - z0;
  function at(
    sampleX: number,
    sampleZ: number
  ): number {
    return sampleX < resolution && sampleZ < resolution ?
      chunk!.sample(sampleX, sampleZ) :
      fineHeight(terrain, origin.x + sampleX / tier, origin.z + sampleZ / tier);
  }
  if (fx === 0 && fz === 0) {
    return at(x0, z0);
  }

  const near = fx === 0 ? at(x0, z0) : at(x0, z0) * (1 - fx) + at(x0 + 1, z0) * fx;
  if (fz === 0) {
    return near;
  }

  const far = fx === 0 ? at(x0, z0 + 1) : at(x0, z0 + 1) * (1 - fx) + at(x0 + 1, z0 + 1) * fx;

  return near * (1 - fz) + far * fz;
}

function apronSource(
  terrain: TerrainReader,
  coord: ChunkCoord
): Pick<SampleBlock, "height"> {
  if (terrain.has(coord) || !terrain.knows(coord)) {
    return terrain.sampleBlock(coord);
  }

  return {
    height: (sampleX, sampleZ) => terrain.sampleAt(sampleX, sampleZ)
  };
}

function intersect(
  left: SampleRect,
  right: SampleRect
): SampleRect | null {
  const x = Math.max(left.x, right.x);
  const z = Math.max(left.z, right.z);
  const width = Math.min(left.x + left.width, right.x + right.width) - x;
  const depth = Math.min(left.z + left.depth, right.z + right.depth) - z;

  return width > 0 && depth > 0 ? { x, z, width, depth } : null;
}

function boundingRect(
  left: SampleRect,
  right: SampleRect
): SampleRect {
  const x = Math.min(left.x, right.x);
  const z = Math.min(left.z, right.z);

  return {
    x,
    z,
    width: Math.max(left.x + left.width, right.x + right.width) - x,
    depth: Math.max(left.z + left.depth, right.z + right.depth) - z
  };
}
