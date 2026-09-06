// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { UVMap } from "#src/uv/UVMap.ts";

describe("UVMap slot boundaries", () => {
  test("rejects a slot the uncollapsed region does not own", () => {
    const map = new UVMap({
      getCanvasSize: () => {
        return { x: 32, y: 32 };
      }
    });
    const region = map.create({ width: 4, height: 4 });
    map.uncollapse(region.id);

    assert.equal(map.move(
      region.id,
      { x: 2, y: 2, width: 4, height: 4 },
      "missing"
    ), false);
    assert.deepEqual(map.get(region.id)?.rectFor("front"), {
      x: 0,
      y: 0,
      width: 4,
      height: 4
    });
  });
});
