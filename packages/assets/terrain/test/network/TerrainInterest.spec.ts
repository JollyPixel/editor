// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { CHUNK_SAMPLES } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  DEFAULT_PRESENCE_RADIUS,
  MAX_PRESENCE_RADIUS,
  TerrainInterest
} from "#src/index.ts";

describe("TerrainInterest", () => {
  test("is centred on the chunk under the camera, negative samples included", () => {
    const interest = TerrainInterest.around(-1, CHUNK_SAMPLES * 2);

    assert.deepEqual(interest.toJSON(), {
      x: -1,
      z: 2,
      radius: DEFAULT_PRESENCE_RADIUS
    });
  });

  test("covers chunks up to the radius on both axes and nothing beyond", () => {
    const interest = TerrainInterest.around(0, 0, 2);

    assert.equal(interest.contains({ x: 2, z: -2 }), true);
    assert.equal(interest.contains({ x: 3, z: 0 }), false);
    assert.equal(interest.containsSample(CHUNK_SAMPLES * 3 - 1, 0), true);
    assert.equal(interest.containsSample(CHUNK_SAMPLES * 3, 0), false);
    assert.equal(interest.overlaps([{ x: 9, z: 9 }, { x: 0, z: -2 }]), true);
    assert.equal(interest.overlaps([{ x: 9, z: 9 }]), false);
  });

  test("round-trips through its presence value", () => {
    const interest = TerrainInterest.around(130, -70, 3);
    const parsed = TerrainInterest.parse(JSON.parse(JSON.stringify(interest)));

    assert.equal(interest.equals(parsed), true);
  });

  test("rejects presence values a peer could not have published", () => {
    for (const value of [
      null,
      { x: 0, z: 0 },
      { x: 0.5, z: 0, radius: 1 },
      { x: 0, z: 0, radius: -1 },
      { x: 0, z: 0, radius: MAX_PRESENCE_RADIUS + 1 }
    ]) {
      assert.equal(TerrainInterest.parse(value), undefined, JSON.stringify(value));
    }
  });
});
