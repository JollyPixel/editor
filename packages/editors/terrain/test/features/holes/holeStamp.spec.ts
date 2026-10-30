// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  CHUNK_SAMPLES,
  ChunkCoord,
  resampleHeights,
  Terrain
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  holeStamp,
  type HoleStamp,
  type HoleTiles
} from "#src/features/holes/model/holeStamp.ts";

function stampAndWrite(
  terrain: Terrain,
  stamp: HoleStamp
): string[] {
  const tiles: HoleTiles = new Map();
  const changed = holeStamp(terrain, tiles, stamp);
  for (const { tile, holes } of tiles.values()) {
    terrain.writeHoleTile(tile, holes);
  }

  return changed.map(({ key }) => key);
}

function holesAround(
  terrain: Terrain,
  x: number,
  z: number
): string[] {
  const found: string[] = [];
  for (let quadZ = z - 4; quadZ <= z + 4; quadZ++) {
    for (let quadX = x - 4; quadX <= x + 4; quadX++) {
      const chunk = terrain.chunk(ChunkCoord.containing(quadX, quadZ));
      const origin = chunk?.coord.originSample;
      if (chunk !== undefined && chunk.holes.isHole(quadX - origin!.x, quadZ - origin!.z)) {
        found.push(`${quadX},${quadZ}`);
      }
    }
  }

  return found;
}

describe("holeStamp", () => {
  test("cuts the quads whose centre lies inside the radius, across chunks, and fill clears them", () => {
    const terrain = new Terrain();
    terrain.addChunk(new ChunkCoord(0, 0));
    terrain.addChunk(new ChunkCoord(1, 0));
    const stamp = { x: CHUNK_SAMPLES, z: 10, radius: 1.2 };

    const cut = stampAndWrite(terrain, { ...stamp, mode: "cut" });
    assert.deepEqual(holesAround(terrain, CHUNK_SAMPLES, 10), ["63,9", "64,9", "63,10", "64,10"]);
    assert.equal(cut.length, 2);
    assert.deepEqual(stampAndWrite(terrain, { ...stamp, mode: "cut" }), []);

    stampAndWrite(terrain, { ...stamp, mode: "fill" });
    assert.deepEqual(holesAround(terrain, CHUNK_SAMPLES, 10), []);
  });

  test("on a x4 chunk a stamp cuts the quads of its own grid", () => {
    const terrain = new Terrain();
    const coord = new ChunkCoord(0, 0);
    terrain.addChunk(coord);
    terrain.changeTier(coord, resampleHeights(terrain, coord, 4));

    stampAndWrite(terrain, { x: 10.125, z: 10.125, radius: 0.1, mode: "cut" });

    const { holes } = terrain.chunk(coord)!;
    assert.deepEqual([holes.isHole(40, 40), holes.isHole(41, 40), terrain.chunk(coord)!.holeAt(10, 10)], [
      true,
      false,
      true
    ]);
  });

  test("the part of a stamp over empty ground changes nothing", () => {
    const terrain = new Terrain();
    terrain.addChunk(new ChunkCoord(0, 0));

    const changed = stampAndWrite(terrain, { x: 0, z: 0, radius: 1, mode: "cut" });

    assert.equal(changed.length, 1);
    assert.deepEqual(holesAround(terrain, 0, 0), ["0,0"]);
  });
});
