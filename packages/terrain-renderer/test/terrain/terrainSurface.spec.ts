// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { CHUNK_SAMPLES, ChunkCoord } from "#src/terrain/ChunkCoord.ts";
import { quadDiagonal } from "#src/terrain/quadDiagonal.ts";
import { CHUNK_SAMPLE_COUNT } from "#src/terrain/TerrainChunk.ts";
import { Terrain } from "#src/terrain/Terrain.ts";
import {
  raycastTerrain,
  surfaceHeight,
  type TerrainRay
} from "#src/terrain/terrainSurface.ts";
import type { Point3 } from "#src/math/point3.ts";
import { bruteRaycastDistance } from "../helpers/bruteRaycast.ts";
import {
  randomInteger,
  seededRandom,
  type Random
} from "../helpers/random.ts";

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

function hills(): Terrain {
  const terrain = new Terrain();
  for (const [x, z] of [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1]]) {
    const coord = new ChunkCoord(x, z);
    terrain.addChunk(coord, hillHeights(coord));
  }

  return terrain;
}

function gappedTerrain(
  random: Random
): Terrain {
  const terrain = new Terrain();
  for (const [x, z] of [[0, 0], [1, 0], [0, 1], [2, 1], [-1, -1]]) {
    const heights = new Float32Array(CHUNK_SAMPLE_COUNT);
    const amplitude = 4 + random() * 8;
    const frequency = 0.05 + random() * 0.2;
    const base = randomInteger(random, -10, 10);
    heights.forEach((_, index) => {
      heights[index] = base + amplitude * Math.sin(index * frequency) +
        randomInteger(random, 0, 3);
    });
    terrain.addChunk(new ChunkCoord(x, z), heights);
  }

  return terrain;
}

function unit(
  x: number,
  y: number,
  z: number
): Point3 {
  const length = Math.hypot(x, y, z);

  return { x: x / length, y: y / length, z: z / length };
}

function sampleRays(
  random: Random
): TerrainRay[] {
  function span(): number {
    return randomInteger(random, -CHUNK_SAMPLES / 2, 2 * CHUNK_SAMPLES) + random();
  }
  function sign(): number {
    return random() < 0.5 ? -1 : 1;
  }
  function border(): number {
    return randomInteger(random, -1, 3) * CHUNK_SAMPLES;
  }
  function spread(): number {
    return random() - 0.5;
  }

  const down = { x: 0, y: -1, z: 0 };
  const rays: TerrainRay[] = [];
  for (let index = 0; index < 4; index++) {
    rays.push(
      { origin: { x: span(), y: 30, z: span() }, direction: unit(spread(), -random(), spread()) },
      { origin: { x: span(), y: 25, z: span() }, direction: unit(sign(), -random() * 0.3, 0) },
      { origin: { x: span(), y: 25, z: span() }, direction: unit(0, -random() * 0.3, sign()) },
      { origin: { x: span(), y: 40, z: span() }, direction: down },
      { origin: { x: border(), y: 40, z: border() }, direction: down },
      { origin: { x: border(), y: 30, z: span() }, direction: unit(0, -0.2, sign()) },
      { origin: { x: border() + 0.5, y: 30, z: border() - 0.5 }, direction: unit(1, -0.15, 1) },
      { origin: { x: span(), y: 30, z: span() }, direction: unit(-random() - 0.1, -0.2, -random() - 0.1) },
      { origin: { x: span(), y: -30, z: span() }, direction: unit(spread(), random(), spread()) },
      { origin: { x: span(), y: 0, z: span() }, direction: unit(spread(), -random() * 0.2, spread()) }
    );
  }

  return rays;
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
    const next = seededRandom(7);
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

  test("finds the nearest downward-facing triangle a brute-force search over every quad finds", () => {
    const random = seededRandom(1234);
    const terrain = gappedTerrain(random);
    let hits = 0;
    let misses = 0;
    for (const [index, ray] of sampleRays(random).entries()) {
      const maxDistance = index % 3 === 0 ? 40 + random() * 120 : Infinity;
      const expected = bruteRaycastDistance(terrain, ray, maxDistance);
      const hit = raycastTerrain(terrain, ray, maxDistance);
      if (expected === null) {
        assert.equal(hit, null, `ray ${index} should miss`);
        misses++;
        continue;
      }

      hits++;
      assert.ok(hit !== null, `ray ${index} should hit at ${expected}`);
      assert.ok(Math.abs(hit.distance - expected) < 1e-6, `ray ${index}: ${hit.distance} vs ${expected}`);
    }

    assert.ok(hits > 10 && misses > 5, `${hits} hits, ${misses} misses`);
  });

  test("a ray running along the terrain's open edge hits that edge", () => {
    const terrain = new Terrain();
    const heights = new Float32Array(CHUNK_SAMPLE_COUNT);
    heights.forEach((_, index) => {
      heights[index] = 5 * Math.sin(index * 0.37) + (index % 7);
    });
    terrain.addChunk(new ChunkCoord(0, 0), heights);
    const ray = { origin: { x: CHUNK_SAMPLES, y: 20, z: 72.193 }, direction: unit(0, -0.2, -1) };
    const hit = raycastTerrain(terrain, ray);

    assert.ok(hit !== null);
    assert.ok(Math.abs(hit.distance - bruteRaycastDistance(terrain, ray)!) < 1e-6);
    assert.equal(hit.point.x, CHUNK_SAMPLES);
  });

  test("the normal is the hit triangle's, pointing up", () => {
    const terrain = new Terrain();
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
    const terrain = new Terrain();
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
