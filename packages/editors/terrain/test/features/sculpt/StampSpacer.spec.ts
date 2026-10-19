// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  StampSpacer,
  type GroundPoint
} from "#src/features/sculpt/model/StampSpacer.ts";

describe("StampSpacer", () => {
  test("stamps land every spacing along the path, however the moves split it", () => {
    for (const splits of [[10], [0.3, 0.3, 4, 0.05, 5.35], [1.25, 1.25, 1.25, 6.25]]) {
      const spacer = new StampSpacer({ x: 0, z: 0 });
      const stamps: GroundPoint[] = [];
      let x = 0;
      for (const step of splits) {
        x += step;
        stamps.push(...spacer.moveTo({ x: x * 0.6, z: x * 0.8 }, 1.25));
      }

      assert.equal(stamps.length, 8, `splits ${splits}`);
      stamps.forEach((point, index) => {
        assert.ok(Math.abs(Math.hypot(point.x, point.z) - (index + 1) * 1.25) < 1e-9);
      });
    }
  });

  test("a move shorter than the spacing places nothing until the distance adds up", () => {
    const spacer = new StampSpacer({ x: 0, z: 0 });

    assert.deepEqual(spacer.moveTo({ x: 0, z: 0 }, 2), []);
    assert.deepEqual(spacer.moveTo({ x: 1.5, z: 0 }, 2), []);
    assert.deepEqual(spacer.moveTo({ x: 1.5, z: 1 }, 2), [{ x: 1.5, z: 0.5 }]);
  });
});
