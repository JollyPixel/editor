// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import { RegionPresence } from "../../../../src/features/placement/collaboration/RegionPresence.ts";

describe("RegionPresence", () => {
  test("rejects malformed voxel payloads", () => {
    const valid = {
      layerName: "Draft",
      region: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 2, y: 1, z: 1 }
      },
      pivot: { x: 1, y: 0, z: 0 },
      origin: { x: 1, y: 0, z: 0 },
      positions: [0, 0, 0, 1, 0, 0],
      voxels: [256, 512],
      partners: [-1, -1]
    };
    const payloads: unknown[] = [
      null,
      { ...valid, layerName: "" },
      { ...valid, region: { min: valid.region.min, max: valid.region.min } },
      { ...valid, pivot: { x: 0.5, y: 0, z: 0 } },
      { ...valid, positions: [0, 0, 0] },
      { ...valid, positions: [0, 0, -1, 1, 0, 0] },
      { ...valid, voxels: [256, -1] },
      { ...valid, voxels: [], positions: [], partners: [] },
      { ...valid, partners: [-1] },
      { ...valid, partners: [-2, -1] }
    ];

    assert.notEqual(RegionPresence.parse(valid), null);
    for (const payload of payloads) {
      assert.equal(RegionPresence.parse(payload), null, JSON.stringify(payload));
    }
  });
});
