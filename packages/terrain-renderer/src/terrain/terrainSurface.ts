// Import Internal Dependencies
import {
  CHUNK_SAMPLES,
  ChunkCoord
} from "./ChunkCoord.ts";
import { quadDiagonal } from "./quadDiagonal.ts";
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
    quadX: number,
    quadZ: number
  ): readonly Triangle[] {
    const origin = this.chunk.coord.originSample;
    const eastBlock = quadX + 1 - origin.x < CHUNK_SAMPLES ? 0 : 1;
    const northBlock = quadZ + 1 - origin.z < CHUNK_SAMPLES ? 0 : 2;
    const [c00, c10, c01, c11] = this.#corners;
    this.#place(c00, quadX, quadZ, 0);
    this.#place(c10, quadX + 1, quadZ, eastBlock);
    this.#place(c01, quadX, quadZ + 1, northBlock);
    this.#place(c11, quadX + 1, quadZ + 1, eastBlock + northBlock);

    return quadDiagonal(quadX, quadZ) === "main" ? this.#main : this.#anti;
  }

  #place(
    corner: QuadCorner,
    sampleX: number,
    sampleZ: number,
    block: number
  ): void {
    corner.x = sampleX;
    corner.y = this.#blocks[block].height(sampleX, sampleZ);
    corner.z = sampleZ;
  }
}

export function surfaceHeight(
  terrain: TerrainReader,
  x: number,
  z: number
): number | null {
  const quadX = Math.floor(x);
  const quadZ = Math.floor(z);
  const coord = ChunkCoord.containing(quadX, quadZ);
  if (!terrain.has(coord)) {
    return null;
  }

  const origin = coord.originSample;
  const sampler: Pick<SampleBlock, "height"> =
    quadX + 1 - origin.x < CHUNK_SAMPLES && quadZ + 1 - origin.z < CHUNK_SAMPLES ?
      terrain.sampleBlock(coord) :
      { height: (sampleX, sampleZ) => terrain.sampleAt(sampleX, sampleZ) };
  const h00 = sampler.height(quadX, quadZ);
  const h10 = sampler.height(quadX + 1, quadZ);
  const h01 = sampler.height(quadX, quadZ + 1);
  const h11 = sampler.height(quadX + 1, quadZ + 1);
  const fx = x - quadX;
  const fz = z - quadZ;
  if (quadDiagonal(quadX, quadZ) === "main") {
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
  const { origin: start, direction } = ray;
  const { holes } = quads.chunk;
  const origin = quads.chunk.coord.originSample;
  const last = { x: origin.x + CHUNK_SAMPLES - 1, z: origin.z + CHUNK_SAMPLES - 1 };
  let quadX = clamp(Math.floor(start.x + direction.x * enter), origin.x, last.x);
  let quadZ = clamp(Math.floor(start.z + direction.z * enter), origin.z, last.z);
  const stepX = Math.sign(direction.x);
  const stepZ = Math.sign(direction.z);
  const deltaX = Math.abs(1 / direction.x);
  const deltaZ = Math.abs(1 / direction.z);
  let eastBlock = boundary(start.x, direction.x, quadX);
  let northBlock = boundary(start.z, direction.z, quadZ);

  while (quadX >= origin.x && quadX <= last.x && quadZ >= origin.z && quadZ <= last.z) {
    const solid = hitHoles || !holes.isHole(quadX - origin.x, quadZ - origin.z);
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
