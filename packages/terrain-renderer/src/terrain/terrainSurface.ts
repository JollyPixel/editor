// Import Internal Dependencies
import {
  CHUNK_SAMPLES,
  ChunkCoord
} from "./ChunkCoord.ts";
import { pointHeight } from "./pointHeight.ts";
import {
  quadDiagonal,
  type QuadDiagonal
} from "./quadDiagonal.ts";
import type { SampleBlock } from "./SampleBlock.ts";
import type {
  HeightRange,
  TerrainChunk
} from "./TerrainChunk.ts";
import type { TerrainReader } from "./Terrain.ts";
import {
  cross,
  dot,
  subtract,
  type Point3
} from "../math/point3.ts";

// CONSTANTS
const kEdgeTolerance = 1e-9;

export interface TerrainRay {
  readonly origin: Point3;
  /**
   * Unit vector; the hit distance is measured along it.
   */
  readonly direction: Point3;
}

export interface TerrainHit {
  readonly point: Point3;
  /**
   * Unit normal of the triangle hit, pointing up.
   */
  readonly normal: Point3;
  readonly distance: number;
}

export interface RaycastOptions {
  readonly maxDistance?: number;
  /**
   * Hit the heights kept under hole quads instead of passing through them.
   */
  readonly hitHoles?: boolean;
}

type Triangle = readonly [Point3, Point3, Point3];

interface QuadCorner {
  x: number;
  y: number;
  z: number;
}

interface RayInterval {
  readonly enter: number;
  readonly exit: number;
}

interface ChunkSpan extends RayInterval {
  readonly quads: ChunkQuads;
}

class ChunkQuads {
  readonly chunk: TerrainChunk;

  #terrain: TerrainReader;
  #blocks: readonly SampleBlock[];
  #corners: readonly [QuadCorner, QuadCorner, QuadCorner, QuadCorner];
  #main: readonly Triangle[];
  #anti: readonly Triangle[];

  constructor(
    terrain: TerrainReader,
    chunk: TerrainChunk
  ) {
    const { x, z } = chunk.coord;
    this.chunk = chunk;
    this.#terrain = terrain;
    this.#blocks = [[0, 0], [1, 0], [0, 1], [1, 1]].map(
      ([dx, dz]) => terrain.sampleBlock(new ChunkCoord(x + dx, z + dz))
    );
    const c00 = { x: 0, y: 0, z: 0 };
    const c10 = { x: 0, y: 0, z: 0 };
    const c01 = { x: 0, y: 0, z: 0 };
    const c11 = { x: 0, y: 0, z: 0 };
    this.#corners = [c00, c10, c01, c11];
    this.#main = [[c00, c10, c11], [c00, c11, c01]];
    this.#anti = [[c00, c10, c01], [c10, c11, c01]];
  }

  get heightRange(): HeightRange {
    let min = Infinity;
    let max = -Infinity;
    for (const block of this.#blocks) {
      const range = block.heightRange;
      if (range !== null) {
        min = Math.min(min, range.min);
        max = Math.max(max, range.max);
      }
    }

    return { min, max };
  }

  triangles(
    gridX: number,
    gridZ: number
  ): readonly Triangle[] {
    const [c00, c10, c01, c11] = this.#corners;
    this.#place(c00, gridX, gridZ);
    this.#place(c10, gridX + 1, gridZ);
    this.#place(c01, gridX, gridZ + 1);
    this.#place(c11, gridX + 1, gridZ + 1);

    return quadDiagonal(gridX, gridZ) === "main" ? this.#main : this.#anti;
  }

  #place(
    corner: QuadCorner,
    gridX: number,
    gridZ: number
  ): void {
    const { tier } = this.chunk;
    const origin = this.chunk.coord.originSample;
    corner.x = origin.x + gridX / tier;
    corner.z = origin.z + gridZ / tier;
    if (tier === 1) {
      const block = (gridX < CHUNK_SAMPLES ? 0 : 1) + (gridZ < CHUNK_SAMPLES ? 0 : 2);
      corner.y = this.#blocks[block].height(corner.x, corner.z);
    }
    else {
      corner.y = refinedCorner(this.#terrain, this.chunk, gridX, gridZ);
    }
  }
}

function refinedCorner(
  terrain: TerrainReader,
  chunk: TerrainChunk,
  gridX: number,
  gridZ: number
): number {
  const { tier, resolution } = chunk;
  const origin = chunk.coord.originSample;
  if (gridX >= resolution || gridZ >= resolution) {
    return pointHeight(terrain, origin.x + gridX / tier, origin.z + gridZ / tier);
  }

  const west = gridX === 0 ? coarserTier(terrain, chunk, -1, 0) : null;
  if (west !== null && gridZ % (tier / west) !== 0) {
    const step = tier / west;
    const first = gridZ - gridZ % step;

    return lerp(
      refinedCorner(terrain, chunk, 0, first),
      refinedCorner(terrain, chunk, 0, first + step),
      (gridZ - first) / step
    );
  }

  const south = gridZ === 0 ? coarserTier(terrain, chunk, 0, -1) : null;
  if (south !== null && gridX % (tier / south) !== 0) {
    const step = tier / south;
    const first = gridX - gridX % step;

    return lerp(
      refinedCorner(terrain, chunk, first, 0),
      refinedCorner(terrain, chunk, first + step, 0),
      (gridX - first) / step
    );
  }

  return chunk.sample(gridX, gridZ);
}

function coarserTier(
  terrain: TerrainReader,
  chunk: TerrainChunk,
  dx: number,
  dz: number
): number | null {
  const coord = new ChunkCoord(chunk.coord.x + dx, chunk.coord.z + dz);
  const tier = terrain.chunk(coord)?.tier ?? (terrain.knows(coord) ? 1 : null);

  return tier !== null && tier < chunk.tier ? tier : null;
}

function lerp(
  from: number,
  to: number,
  blend: number
): number {
  return from + (to - from) * blend;
}

export function surfaceHeight(
  terrain: TerrainReader,
  x: number,
  z: number
): number | null {
  const quadX = Math.floor(x);
  const quadZ = Math.floor(z);
  const coord = ChunkCoord.containing(quadX, quadZ);
  const chunk = terrain.chunk(coord);
  if (chunk === undefined) {
    return null;
  }

  const origin = coord.originSample;
  if (chunk.tier !== 1) {
    const gridX = (x - origin.x) * chunk.tier;
    const gridZ = (z - origin.z) * chunk.tier;
    const cellX = Math.floor(gridX);
    const cellZ = Math.floor(gridZ);

    return triangleHeight(
      (dx, dz) => refinedCorner(terrain, chunk, cellX + dx, cellZ + dz),
      quadDiagonal(cellX, cellZ),
      gridX - cellX,
      gridZ - cellZ
    );
  }

  const sampler: Pick<SampleBlock, "height"> =
    quadX + 1 - origin.x < CHUNK_SAMPLES && quadZ + 1 - origin.z < CHUNK_SAMPLES ?
      terrain.sampleBlock(coord) :
      { height: (sampleX, sampleZ) => terrain.sampleAt(sampleX, sampleZ) };

  return triangleHeight(
    (dx, dz) => sampler.height(quadX + dx, quadZ + dz),
    quadDiagonal(quadX, quadZ),
    x - quadX,
    z - quadZ
  );
}

function triangleHeight(
  corner: (dx: number, dz: number) => number,
  diagonal: QuadDiagonal,
  fx: number,
  fz: number
): number {
  const h00 = corner(0, 0);
  const h10 = corner(1, 0);
  const h01 = corner(0, 1);
  const h11 = corner(1, 1);
  if (diagonal === "main") {
    return fx >= fz ?
      h00 + fx * (h10 - h00) + fz * (h11 - h10) :
      h00 + fz * (h01 - h00) + fx * (h11 - h01);
  }

  return fx + fz <= 1 ?
    h00 + fx * (h10 - h00) + fz * (h01 - h00) :
    h11 + (1 - fx) * (h01 - h11) + (1 - fz) * (h10 - h11);
}

export function raycastTerrain(
  terrain: TerrainReader,
  ray: TerrainRay,
  options: RaycastOptions = {}
): TerrainHit | null {
  const { maxDistance = Infinity, hitHoles = false } = options;
  const spans: ChunkSpan[] = [];
  for (const chunk of terrain.chunks()) {
    const footprint = footprintSpan(chunk, ray, maxDistance);
    if (footprint === null) {
      continue;
    }

    const quads = new ChunkQuads(terrain, chunk);
    const { min, max } = quads.heightRange;
    const span = clipSlab(footprint, ray.origin.y, ray.direction.y, min, max);
    if (span !== null) {
      spans.push({ quads, ...span });
    }
  }
  spans.sort((left, right) => left.enter - right.enter);

  let nearest: TerrainHit | null = null;
  for (const span of spans) {
    if (nearest !== null && span.enter > nearest.distance) {
      break;
    }

    const hit = marchChunk(span, ray, hitHoles);
    const closer = hit !== null && (nearest === null || hit.distance < nearest.distance);
    if (closer && hit.distance <= maxDistance) {
      nearest = hit;
    }
  }

  return nearest;
}

function footprintSpan(
  chunk: TerrainChunk,
  ray: TerrainRay,
  maxDistance: number
): RayInterval | null {
  const origin = chunk.coord.originSample;
  const alongX = clipSlab(
    { enter: 0, exit: maxDistance },
    ray.origin.x,
    ray.direction.x,
    origin.x,
    origin.x + CHUNK_SAMPLES
  );
  if (alongX === null) {
    return null;
  }

  return clipSlab(
    alongX,
    ray.origin.z,
    ray.direction.z,
    origin.z,
    origin.z + CHUNK_SAMPLES
  );
}

function clipSlab(
  interval: RayInterval,
  start: number,
  direction: number,
  min: number,
  max: number
): RayInterval | null {
  if (direction === 0) {
    return start < min || start > max ? null : interval;
  }

  const near = (min - start) / direction;
  const far = (max - start) / direction;
  const enter = Math.max(interval.enter, Math.min(near, far));
  const exit = Math.min(interval.exit, Math.max(near, far));

  return enter <= exit ? { enter, exit } : null;
}

function marchChunk(
  { quads, enter, exit }: ChunkSpan,
  ray: TerrainRay,
  hitHoles: boolean
): TerrainHit | null {
  const { direction } = ray;
  const { chunk } = quads;
  const { tier, resolution } = chunk;
  const origin = chunk.coord.originSample;
  const start = {
    x: (ray.origin.x - origin.x) * tier,
    z: (ray.origin.z - origin.z) * tier
  };
  const along = { x: direction.x * tier, z: direction.z * tier };
  const last = resolution - 1;
  let quadX = clamp(Math.floor(start.x + along.x * enter), 0, last);
  let quadZ = clamp(Math.floor(start.z + along.z * enter), 0, last);
  const stepX = Math.sign(along.x);
  const stepZ = Math.sign(along.z);
  const deltaX = Math.abs(1 / along.x);
  const deltaZ = Math.abs(1 / along.z);
  let eastBlock = boundary(start.x, along.x, quadX);
  let northBlock = boundary(start.z, along.z, quadZ);

  while (quadX >= 0 && quadX <= last && quadZ >= 0 && quadZ <= last) {
    const solid = hitHoles || !chunk.holes.isHole(quadX, quadZ);
    const hit = solid ? hitQuad(quads.triangles(quadX, quadZ), ray) : null;
    if (hit !== null) {
      return hit;
    }
    if (Math.min(eastBlock, northBlock) > exit) {
      return null;
    }

    if (eastBlock < northBlock) {
      quadX += stepX;
      eastBlock += deltaX;
    }
    else {
      quadZ += stepZ;
      northBlock += deltaZ;
    }
  }

  return null;
}

function hitQuad(
  triangles: readonly Triangle[],
  ray: TerrainRay
): TerrainHit | null {
  let nearest: TerrainHit | null = null;
  for (const triangle of triangles) {
    const hit = hitTriangle(ray, triangle);
    if (hit !== null && (nearest === null || hit.distance < nearest.distance)) {
      nearest = hit;
    }
  }

  return nearest;
}

function hitTriangle(
  { origin, direction }: TerrainRay,
  [a, b, c]: Triangle
): TerrainHit | null {
  const edge1 = subtract(b, a);
  const edge2 = subtract(c, a);
  const p = cross(direction, edge2);
  const determinant = dot(edge1, p);
  if (Math.abs(determinant) < 1e-12) {
    return null;
  }

  const toOrigin = subtract(origin, a);
  const u = dot(toOrigin, p) / determinant;
  if (u < -kEdgeTolerance || u > 1 + kEdgeTolerance) {
    return null;
  }
  const q = cross(toOrigin, edge1);
  const v = dot(direction, q) / determinant;
  if (v < -kEdgeTolerance || u + v > 1 + kEdgeTolerance) {
    return null;
  }
  const distance = dot(edge2, q) / determinant;
  if (distance < 0) {
    return null;
  }

  const normal = cross(edge2, edge1);
  const length = Math.hypot(normal.x, normal.y, normal.z) * Math.sign(normal.y);
  if (dot(direction, normal) * Math.sign(normal.y) >= 0) {
    return null;
  }

  return {
    point: {
      x: origin.x + direction.x * distance,
      y: origin.y + direction.y * distance,
      z: origin.z + direction.z * distance
    },
    normal: { x: normal.x / length, y: normal.y / length, z: normal.z / length },
    distance
  };
}

function boundary(
  start: number,
  direction: number,
  quad: number
): number {
  if (direction === 0) {
    return Infinity;
  }

  return ((direction > 0 ? quad + 1 : quad) - start) / direction;
}

function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.min(Math.max(value, min), max);
}
