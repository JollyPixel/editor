// Import Internal Dependencies
import {
  CHUNK_SAMPLES,
  ChunkCoord
} from "./ChunkCoord.ts";
import { quadDiagonal } from "./quadDiagonal.ts";
import type { TerrainChunk } from "./TerrainChunk.ts";
import type { TerrainReader } from "./TerrainDocument.ts";

export interface Point3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

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

type Triangle = readonly [Point3, Point3, Point3];

interface ChunkSpan {
  readonly chunk: TerrainChunk;
  readonly enter: number;
  readonly exit: number;
}

export function surfaceHeight(
  terrain: TerrainReader,
  x: number,
  z: number
): number | null {
  const quadX = Math.floor(x);
  const quadZ = Math.floor(z);
  const chunk = terrain.chunk(ChunkCoord.containing(quadX, quadZ));
  if (chunk === undefined) {
    return null;
  }

  const h00 = cornerHeight(terrain, chunk, quadX, quadZ);
  const h10 = cornerHeight(terrain, chunk, quadX + 1, quadZ);
  const h01 = cornerHeight(terrain, chunk, quadX, quadZ + 1);
  const h11 = cornerHeight(terrain, chunk, quadX + 1, quadZ + 1);
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
  maxDistance = Infinity
): TerrainHit | null {
  const spans: ChunkSpan[] = [];
  for (const chunk of terrain.chunks()) {
    const span = chunkSpan(terrain, chunk, ray, maxDistance);
    if (span !== null) {
      spans.push(span);
    }
  }
  spans.sort((left, right) => left.enter - right.enter);

  let nearest: TerrainHit | null = null;
  for (const span of spans) {
    if (nearest !== null && span.enter > nearest.distance) {
      break;
    }

    const hit = marchChunk(terrain, span, ray);
    const closer = hit !== null && (nearest === null || hit.distance < nearest.distance);
    if (closer && hit.distance <= maxDistance) {
      nearest = hit;
    }
  }

  return nearest;
}

function cornerHeight(
  terrain: TerrainReader,
  quadChunk: TerrainChunk,
  sampleX: number,
  sampleZ: number
): number {
  const owner = terrain.chunk(ChunkCoord.containing(sampleX, sampleZ)) ?? quadChunk;
  const origin = owner.coord.originSample;

  return owner.height(
    clampLocal(sampleX - origin.x),
    clampLocal(sampleZ - origin.z)
  );
}

function chunkSpan(
  terrain: TerrainReader,
  chunk: TerrainChunk,
  ray: TerrainRay,
  maxDistance: number
): ChunkSpan | null {
  let minY = chunk.heightRange.min;
  let maxY = chunk.heightRange.max;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const neighbour = terrain.chunk(new ChunkCoord(chunk.coord.x + dx, chunk.coord.z + dz));
      if (neighbour !== undefined) {
        minY = Math.min(minY, neighbour.heightRange.min);
        maxY = Math.max(maxY, neighbour.heightRange.max);
      }
    }
  }

  const origin = chunk.coord.originSample;
  let enter = 0;
  let exit = maxDistance;
  for (const [start, direction, min, max] of [
    [ray.origin.x, ray.direction.x, origin.x, origin.x + CHUNK_SAMPLES],
    [ray.origin.y, ray.direction.y, minY, maxY],
    [ray.origin.z, ray.direction.z, origin.z, origin.z + CHUNK_SAMPLES]
  ]) {
    if (direction === 0) {
      if (start < min || start > max) {
        return null;
      }
      continue;
    }

    const near = (min - start) / direction;
    const far = (max - start) / direction;
    enter = Math.max(enter, Math.min(near, far));
    exit = Math.min(exit, Math.max(near, far));
  }

  return enter <= exit ? { chunk, enter, exit } : null;
}

function marchChunk(
  terrain: TerrainReader,
  { chunk, enter, exit }: ChunkSpan,
  ray: TerrainRay
): TerrainHit | null {
  const { origin: start, direction } = ray;
  const origin = chunk.coord.originSample;
  const last = { x: origin.x + CHUNK_SAMPLES - 1, z: origin.z + CHUNK_SAMPLES - 1 };
  let quadX = clamp(Math.floor(start.x + direction.x * enter), origin.x, last.x);
  let quadZ = clamp(Math.floor(start.z + direction.z * enter), origin.z, last.z);
  const stepX = Math.sign(direction.x);
  const stepZ = Math.sign(direction.z);
  const deltaX = Math.abs(1 / direction.x);
  const deltaZ = Math.abs(1 / direction.z);
  let nextX = boundary(start.x, direction.x, quadX);
  let nextZ = boundary(start.z, direction.z, quadZ);

  while (quadX >= origin.x && quadX <= last.x && quadZ >= origin.z && quadZ <= last.z) {
    const hit = hitQuad(terrain, chunk, ray, quadX, quadZ);
    if (hit !== null) {
      return hit;
    }
    if (Math.min(nextX, nextZ) > exit) {
      return null;
    }

    if (nextX < nextZ) {
      quadX += stepX;
      nextX += deltaX;
    }
    else {
      quadZ += stepZ;
      nextZ += deltaZ;
    }
  }

  return null;
}

function hitQuad(
  terrain: TerrainReader,
  chunk: TerrainChunk,
  ray: TerrainRay,
  quadX: number,
  quadZ: number
): TerrainHit | null {
  const [c00, c10, c01, c11] = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dz]) => {
    return {
      x: quadX + dx,
      y: cornerHeight(terrain, chunk, quadX + dx, quadZ + dz),
      z: quadZ + dz
    };
  });
  const triangles: Triangle[] = quadDiagonal(quadX, quadZ) === "main" ?
    [[c00, c10, c11], [c00, c11, c01]] :
    [[c00, c10, c01], [c10, c11, c01]];

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
  if (u < 0 || u > 1) {
    return null;
  }
  const q = cross(toOrigin, edge1);
  const v = dot(direction, q) / determinant;
  if (v < 0 || u + v > 1) {
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

function subtract(
  left: Point3,
  right: Point3
): Point3 {
  return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z };
}

function cross(
  left: Point3,
  right: Point3
): Point3 {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x
  };
}

function dot(
  left: Point3,
  right: Point3
): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.min(Math.max(value, min), max);
}

function clampLocal(
  local: number
): number {
  return clamp(local, 0, CHUNK_SAMPLES - 1);
}
