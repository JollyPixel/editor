// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  ChunkCoord,
  SPLAT_CHANNELS,
  Terrain,
  uniformSplat
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  blendTexel,
  paintStamp,
  type PaintTiles
} from "#src/features/paint/model/paintStamp.ts";

function texel(
  indices: number[],
  weights: number[]
) {
  return {
    indices: new Uint8Array(indices),
    weights: new Uint8Array(weights)
  };
}

function slotWeights(
  { indices, weights }: ReturnType<typeof texel>
): Record<number, number> {
  const result: Record<number, number> = {};
  for (let channel = 0; channel < SPLAT_CHANNELS; channel++) {
    if (weights[channel] > 0) {
      result[indices[channel]] = (result[indices[channel]] ?? 0) + weights[channel];
    }
  }

  return result;
}

describe("blendTexel", () => {
  test("painting moves the texel toward the material and keeps 255 in total", () => {
    const splat = texel([0, 0, 0, 0], [255, 0, 0, 0]);

    blendTexel(splat, 0, 4, 0.25);

    assert.deepEqual(slotWeights(splat), { 0: 191, 4: 64 });
  });

  test("a material not among the four replaces the weakest, whose weight goes to the others", () => {
    const splat = texel([1, 2, 3, 5], [100, 80, 60, 15]);

    blendTexel(splat, 0, 9, 0.2);

    const weights = slotWeights(splat);
    assert.equal(weights[5], undefined);
    assert.equal(weights[9], 51);
    assert.equal(Object.values(weights).reduce((sum, weight) => sum + weight, 0), 255);
  });

  test("full strength leaves only the painted material", () => {
    const splat = texel([1, 2, 3, 4], [64, 64, 64, 63]);

    blendTexel(splat, 0, 2, 1);

    assert.deepEqual(slotWeights(splat), { 2: 255 });
  });
});

describe("paintStamp", () => {
  test("a stamp paints more at its centre than near its edge, and only on known chunks", () => {
    const terrain = new Terrain();
    terrain.addChunk(new ChunkCoord(0, 0));
    const tiles: PaintTiles = new Map();

    const touched = paintStamp(terrain, tiles, {
      x: 63,
      z: 10,
      radius: 4,
      strength: 0.5,
      falloff: "linear",
      slot: 6
    });

    assert.deepEqual(touched.map(({ chunk }) => chunk.key), ["0,0"]);
    const tile = tiles.get(touched[0].key)!;
    function at(localX: number, localZ: number): number {
      return tile.splat.weights[((localZ % 32) * 32 + localX % 32) * SPLAT_CHANNELS + 1];
    }
    assert.ok(at(125, 20) > at(119, 20));
    assert.equal(at(100, 20), 0);
  });

  test("a stamp over a chunk border paints the tiles on both sides from their current splat", () => {
    const terrain = new Terrain();
    terrain.addChunk(new ChunkCoord(0, 0), undefined, uniformSplat(128 * 128, 3));
    terrain.addChunk(new ChunkCoord(1, 0));
    const tiles: PaintTiles = new Map();

    const touched = paintStamp(terrain, tiles, {
      x: 64,
      z: 8,
      radius: 2,
      strength: 1,
      falloff: "constant",
      slot: 7
    });

    assert.deepEqual(touched.map(({ key }) => key).sort(), ["0,0:3", "1,0:0"]);
    const left = tiles.get("0,0:3")!.splat;
    assert.deepEqual([left.indices[0], left.weights[0]], [3, 255]);
  });
});
