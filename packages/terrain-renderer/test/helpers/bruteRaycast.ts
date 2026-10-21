// Import Internal Dependencies
import { CHUNK_SAMPLES } from "#src/terrain/ChunkCoord.ts";
import { quadDiagonal } from "#src/terrain/quadDiagonal.ts";
import type { TerrainReader } from "#src/terrain/Terrain.ts";
import type { TerrainRay } from "#src/terrain/terrainSurface.ts";
import {
  cross,
  dot,
  subtract,
  type Point3
} from "#src/math/point3.ts";

// CONSTANTS
const kVertices = CHUNK_SAMPLES + 1;

type Triangle = readonly [Point3, Point3, Point3];

export function bruteRaycastDistance(
  terrain: TerrainReader,
  ray: TerrainRay,
  maxDistance = Infinity
): number | null {
  let nearest: number | null = null;
  for (const chunk of terrain.chunks()) {
    for (const [a, b, c] of chunkTriangles(terrain, chunk.coord.originSample)) {
      const distance = downwardHit(ray, a, b, c);
      if (distance !== null && distance <= maxDistance && (nearest === null || distance < nearest)) {
        nearest = distance;
      }
    }
  }

  return nearest;
}

function* chunkTriangles(
  terrain: TerrainReader,
  origin: { x: number; z: number; }
): IterableIterator<Triangle> {
  const heights = new Float64Array(kVertices * kVertices);
  for (let localZ = 0; localZ < kVertices; localZ++) {
    for (let localX = 0; localX < kVertices; localX++) {
      heights[localZ * kVertices + localX] = terrain.sampleAt(origin.x + localX, origin.z + localZ);
    }
  }
  function vertex(
    localX: number,
    localZ: number
  ): Point3 {
    return {
      x: origin.x + localX,
      y: heights[localZ * kVertices + localX],
      z: origin.z + localZ
    };
  }

  for (let localZ = 0; localZ < CHUNK_SAMPLES; localZ++) {
    for (let localX = 0; localX < CHUNK_SAMPLES; localX++) {
      const c00 = vertex(localX, localZ);
      const c10 = vertex(localX + 1, localZ);
      const c01 = vertex(localX, localZ + 1);
      const c11 = vertex(localX + 1, localZ + 1);
      if (quadDiagonal(origin.x + localX, origin.z + localZ) === "main") {
        yield [c00, c10, c11];
        yield [c00, c11, c01];
      }
      else {
        yield [c00, c10, c01];
        yield [c10, c11, c01];
      }
    }
  }
}

function downwardHit(
  { origin, direction }: TerrainRay,
  a: Point3,
  b: Point3,
  c: Point3
): number | null {
  const ab = subtract(b, a);
  const ac = subtract(c, a);
  const normal = cross(ac, ab);
  const facing = dot(direction, normal) * Math.sign(normal.y);
  if (facing >= 0) {
    return null;
  }

  const distance = dot(subtract(a, origin), normal) / dot(direction, normal);
  if (distance < 0) {
    return null;
  }

  const point = {
    x: origin.x + direction.x * distance,
    y: origin.y + direction.y * distance,
    z: origin.z + direction.z * distance
  };
  const sides = [[a, b], [b, c], [c, a]].map(
    ([from, to]) => dot(cross(subtract(to, from), subtract(point, from)), normal)
  );
  const inside = sides.every((side) => side >= -1e-9) || sides.every((side) => side <= 1e-9);

  return inside ? distance : null;
}
