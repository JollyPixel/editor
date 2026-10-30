// Import Third-party Dependencies
import {
  CHUNK_SAMPLES,
  ChunkCoord,
  type TerrainHit,
  type TerrainRay,
  type TerrainReader
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import type { GroundPoint } from "../../brush/model/StampSpacer.ts";

// CONSTANTS
const kPlaneRefinements = 3;

export interface ChunkTarget {
  readonly coord: ChunkCoord;
  readonly point: GroundPoint;
  readonly height: number;
}

export interface PlaneHit {
  readonly point: GroundPoint;
  readonly distance: number;
}

export function rayOnPlane(
  { origin, direction }: TerrainRay,
  height: number,
  maxDistance = Infinity
): PlaneHit | null {
  const distance = (height - origin.y) / direction.y;
  if (!Number.isFinite(distance) || distance < 0 || distance > maxDistance) {
    return null;
  }

  return {
    point: {
      x: origin.x + direction.x * distance,
      z: origin.z + direction.z * distance
    },
    distance
  };
}

export function edgeHeight(
  terrain: TerrainReader,
  coord: ChunkCoord
): number {
  const heights = terrain.seedHeights(coord);
  const last = CHUNK_SAMPLES - 1;
  let sum = 0;
  for (let index = 0; index < last; index++) {
    sum += heights[index] +
      heights[index * CHUNK_SAMPLES + last] +
      heights[last * CHUNK_SAMPLES + last - index] +
      heights[(last - index) * CHUNK_SAMPLES];
  }

  return sum / (last * 4);
}

export function emptyGroundTarget(
  terrain: TerrainReader,
  ray: TerrainRay,
  maxDistance = Infinity
): (ChunkTarget & PlaneHit) | null {
  let height = 0;
  let hit = rayOnPlane(ray, height, maxDistance);
  for (let refinement = 0; hit !== null && refinement < kPlaneRefinements; refinement++) {
    const next = edgeHeight(terrain, ChunkCoord.containing(hit.point.x, hit.point.z));
    if (next === height) {
      break;
    }
    height = next;
    hit = rayOnPlane(ray, height, maxDistance);
  }
  if (hit === null) {
    return null;
  }

  const coord = ChunkCoord.containing(hit.point.x, hit.point.z);

  return terrain.knows(coord) ? null : { ...hit, coord, height };
}

export function surfaceTarget(
  terrain: TerrainReader,
  { point }: TerrainHit
): ChunkTarget | null {
  const coord = ChunkCoord.containing(point.x, point.z);

  return terrain.has(coord) ?
    { coord, point: { x: point.x, z: point.z }, height: point.y } :
    null;
}
