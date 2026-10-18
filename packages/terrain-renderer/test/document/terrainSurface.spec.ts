// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  CHUNK_SAMPLE_COUNT,
  CHUNK_SAMPLES,
  ChunkCoord,
  quadDiagonal,
  raycastTerrain,
  surfaceHeight,
  TerrainDocument,
  type Point3,
  type TerrainRay
} from "#src/index.ts";

// CONSTANTS
const kMarchStep = 0.01;

function hillHeights(
  coord: ChunkCoord
): Float32Array {
  const heights = new Float32Array(CHUNK_SAMPLE_COUNT);
  const origin = coord.originSample;
  for (let localZ = 0; localZ < CHUNK_SAMPLES; localZ++) {
    for (let localX = 0; localX < CHUNK_SAMPLES; localX++) {
      const x = origin.x + localX;
      const z = origin.z + localZ;
      heights[localZ * CHUNK_SAMPLES + localX] = 6 * Math.sin(x * 0.11) * Math.cos(z * 0.07) + (x % 3);
    }
  }

  return heights;
}

function hills(): TerrainDocument {
  const terrain = new TerrainDocument();
  for (const [x, z] of [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1]]) {
    const coord = new ChunkCoord(x, z);
    terrain.addChunk(coord, hillHeights(coord));
  }

  return terrain;
}

function random(
  seed: number
): () => number {
  let state = seed;

  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;

    return state / 4294967296;
  };
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
  terrain: TerrainDocument,
  { origin, direction }: TerrainRay,
  maxDistance: number
): number | null {
  let above = false;
  for (let distance = 0; distance <= maxDistance; distance += kMarchStep) {
    const height = surfaceHeight(
      terrain,
      origin.x + direction.x * distance,
      origin.z + direction.z * distance
    );
    const below = height !== null && origin.y + direction.y * distance <= height;
    if (below && above) {
      return distance;
    }
    above = height !== null && !below;
  }

  return null;
}

describe("surfaceHeight", () => {
  test("passes through every sample and splits each quad along its diagonal", () => {
    const terrain = hills();
    const chunk = terrain.chunk(new ChunkCoord(1, 0))!;
    for (const [localX, localZ] of [[0, 0], [7, 30], [63, 50]]) {
      const x = CHUNK_SAMPLES + localX;
      const h00 = chunk.height(localX, localZ);
      const h10 = terrain.sampleAt(x + 1, localZ);
      const h01 = terrain.sampleAt(x, localZ + 1);
      const h11 = terrain.sampleAt(x + 1, localZ + 1);
      const centre = quadDiagonal(x, localZ) === "main" ? (h00 + h11) / 2 : (h10 + h01) / 2;

      assert.equal(surfaceHeight(terrain, x, localZ), h00);
      assert.ok(Math.abs(surfaceHeight(terrain, x + 0.5, localZ + 0.5)! - centre) < 1e-6);
    }
  });

  test("the last quad before empty ground repeats the chunk's outer samples", () => {
    const terrain = hills();
    const chunk = terrain.chunk(new ChunkCoord(0, 1))!;
    const z = CHUNK_SAMPLES + 20;

    assert.equal(surfaceHeight(terrain, CHUNK_SAMPLES - 0.5, z), chunk.height(CHUNK_SAMPLES - 1, 20));
    assert.equal(surfaceHeight(terrain, CHUNK_SAMPLES + 0.5, z), null);
  });
});

describe("raycastTerrain", () => {
  test("hits the first point where the ray meets the surface", () => {
    const terrain = hills();
    const next = random(7);
    let hits = 0;
    for (let index = 0; index < 40; index++) {
      const ray = rayToward(
        { x: next() * 200 - 10, y: 20 + next() * 40, z: next() * 140 - 10 },
        { x: next() * 192, y: 0, z: next() * 128 }
      );
      const hit = raycastTerrain(terrain, ray);
      const marched = marchedDistance(terrain, ray, 400);
      if (marched === null) {
        assert.equal(hit, null);
        continue;
      }

      hits++;
      assert.ok(hit !== null, `ray ${index} should hit near ${marched}`);
      assert.ok(
        Math.abs(hit.distance - marched) < kMarchStep * 2,
        `ray ${index}: ${hit.distance} vs ${marched}`
      );
      assert.ok(Math.abs(hit.point.y - surfaceHeight(terrain, hit.point.x, hit.point.z)!) < 1e-6);
    }

    assert.ok(hits > 25);
  });

  test("the normal is the hit triangle's, pointing up", () => {
    const terrain = new TerrainDocument();
    const heights = new Float32Array(CHUNK_SAMPLE_COUNT);
    heights.forEach((_, index) => {
      heights[index] = (index % CHUNK_SAMPLES) * 0.5;
    });
    terrain.addChunk(new ChunkCoord(0, 0), heights);
    const hit = raycastTerrain(terrain, rayToward({ x: 20.3, y: 50, z: 30.6 }, { x: 20.3, y: 0, z: 30.6 }))!;
    const length = Math.hypot(0.5, 1);

    assert.ok(Math.abs(hit.point.y - 10.15) < 1e-6);
    assert.ok(Math.abs(hit.normal.x + 0.5 / length) < 1e-9);
    assert.ok(Math.abs(hit.normal.y - 1 / length) < 1e-9);
    assert.ok(Math.abs(hit.normal.z) < 1e-9);
  });

  test("the last quad of a chunk climbs to its taller neighbour's edge", () => {
    const terrain = new TerrainDocument();
    terrain.addChunk(new ChunkCoord(0, 0));
    terrain.addChunk(new ChunkCoord(1, 0), new Float32Array(CHUNK_SAMPLE_COUNT).fill(10));
    const hit = raycastTerrain(terrain, rayToward({ x: 40, y: 9.5, z: 20.5 }, { x: 140, y: 8.5, z: 20.5 }))!;

    assert.ok(hit.point.x > CHUNK_SAMPLES - 1 && hit.point.x < CHUNK_SAMPLES);
    assert.ok(Math.abs(hit.point.y - surfaceHeight(terrain, hit.point.x, 20.5)!) < 1e-6);
  });

  test("a ray over empty ground, or stopped short of the surface, has no hit", () => {
    const terrain = hills();
    const down = rayToward({ x: 100, y: 30, z: 100 }, { x: 100, y: 0, z: 100 });

    assert.equal(raycastTerrain(terrain, down), null);
    const short = rayToward({ x: 30, y: 30, z: 30 }, { x: 30, y: 0, z: 30 });
    assert.equal(raycastTerrain(terrain, short, 5), null);
  });
});
