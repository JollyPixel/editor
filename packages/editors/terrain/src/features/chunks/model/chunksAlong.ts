// Import Third-party Dependencies
import {
  CHUNK_SAMPLES,
  ChunkCoord
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import type { GroundPoint } from "../../brush/model/StampSpacer.ts";

export function chunksAlong(
  from: GroundPoint,
  to: GroundPoint
): ChunkCoord[] {
  const start = ChunkCoord.containing(from.x, from.z);
  const end = ChunkCoord.containing(to.x, to.z);
  const coords = [start];
  const stepX = Math.sign(end.x - start.x);
  const stepZ = Math.sign(end.z - start.z);
  const deltaX = Math.abs(CHUNK_SAMPLES / (to.x - from.x));
  const deltaZ = Math.abs(CHUNK_SAMPLES / (to.z - from.z));
  let crossX = boundaryDistance(from.x, start.x, stepX) * deltaX;
  let crossZ = boundaryDistance(from.z, start.z, stepZ) * deltaZ;
  let { x, z } = start;
  while (x !== end.x || z !== end.z) {
    if (z === end.z || (x !== end.x && crossX < crossZ)) {
      x += stepX;
      crossX += deltaX;
    }
    else {
      z += stepZ;
      crossZ += deltaZ;
    }
    coords.push(new ChunkCoord(x, z));
  }

  return coords;
}

function boundaryDistance(
  position: number,
  chunk: number,
  step: number
): number {
  const local = position / CHUNK_SAMPLES - chunk;

  return step > 0 ? 1 - local : local;
}
