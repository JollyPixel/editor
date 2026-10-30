// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ChunkCoord } from "#src/terrain/ChunkCoord.ts";
import { chunkResolution } from "#src/terrain/chunkTier.ts";
import { Terrain } from "#src/terrain/Terrain.ts";
import {
  raycastTerrain,
  surfaceHeight,
  type TerrainRay
} from "#src/terrain/terrainSurface.ts";
import type { Point3 } from "#src/math/point3.ts";

// CONSTANTS
const kTier = 2;
const kResolution = chunkResolution(kTier);
const kMarchStep = 0.005;

function refinedTerrain(
  samples: Record<string, number>
): Terrain {
  const terrain = new Terrain();
  terrain.addChunk(new ChunkCoord(0, 0));
  const heights = new Float32Array(kResolution * kResolution);
  for (const [key, height] of Object.entries(samples)) {
    const [gridX, gridZ] = key.split(",").map(Number);
    heights[gridZ * kResolution + gridX] = height;
  }
  terrain.addChunk(new ChunkCoord(1, 0), heights);

  return terrain;
}

function bumpyTerrain(): Terrain {
  const samples: Record<string, number> = {};
  for (let gridZ = 0; gridZ < 24; gridZ++) {
    for (let gridX = 0; gridX < 24; gridX++) {
      samples[`${gridX},${gridZ}`] = 3 * Math.sin(gridX * 1.9) * Math.cos(gridZ * 1.4);
    }
  }

  return refinedTerrain(samples);
}

function rayToward(
  origin: Point3,
  target: Point3
): TerrainRay {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const dz = target.z - origin.z;
  const length = Math.hypot(dx, dy, dz);

  return { origin, direction: { x: dx / length, y: dy / length, z: dz / length } };
}

function marchedDistance(
  terrain: Terrain,
  { origin, direction }: TerrainRay,
  maxDistance: number
): number | null {
  for (let distance = 0; distance <= maxDistance; distance += kMarchStep) {
    const x = origin.x + direction.x * distance;
    const height = surfaceHeight(terrain, x, origin.z + direction.z * distance);
    if (height !== null && origin.y + direction.y * distance <= height) {
      return distance;
    }
  }

  return null;
}

describe("refined surface", () => {
  test("follows the chunk's own samples, and along a coarser neighbour's edge its straight segments", () => {
    const terrain = refinedTerrain({ "5,7": 4, "0,9": 6 });

    assert.equal(surfaceHeight(terrain, 64 + 2.5, 3.5), 4);
    assert.equal(surfaceHeight(terrain, 64, 4.5), 0);
    assert.equal(surfaceHeight(terrain, 64 + 2.25, 3.5), 2);
    const down = rayToward({ x: 66.5, y: 20, z: 3.5 }, { x: 66.5, y: 0, z: 3.5 });
    assert.equal(raycastTerrain(terrain, down)?.point.y, 4);
  });

  test("a ray hits the first point of the refined surface a fine march finds", () => {
    const terrain = bumpyTerrain();
    const targets = [{ x: 66.3, z: 4.1 }, { x: 69.7, z: 2.2 }, { x: 64.6, z: 9.9 }, { x: 70.2, z: 7.4 }];
    for (const target of targets) {
      const ray = rayToward({ x: target.x - 6, y: 8, z: target.z + 3 }, { ...target, y: -3 });
      const expected = marchedDistance(terrain, ray, 30);
      const hit = raycastTerrain(terrain, ray);

      assert.ok(expected !== null && hit !== null, `ray toward (${target.x}, ${target.z})`);
      assert.ok(Math.abs(hit.distance - expected) < kMarchStep * 2, `ray toward (${target.x}, ${target.z})`);
    }
  });
});
