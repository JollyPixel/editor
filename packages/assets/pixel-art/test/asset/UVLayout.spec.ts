// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { UVRegion } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  uvLayoutOf,
  uvRegionOf,
  type UVLayoutData
} from "#src/asset/UVLayout.ts";

// CONSTANTS
const kLayout: UVLayoutData = {
  state: "stacked",
  rect: { x: 4, y: 8, width: 16, height: 16 }
};

describe("network/UVLayout", () => {
  test("a layout is a region without its identity", () => {
    const region = new UVRegion({
      ...kLayout,
      id: "a",
      name: "A",
      color: "#fff"
    });

    assert.deepEqual(uvLayoutOf(region), kLayout);
  });

  test("a region rebuilt from a layout carries the given identity", () => {
    const region = uvRegionOf(kLayout, {
      id: "a",
      name: "A",
      color: "#fff"
    });

    assert.equal(region.id, "a");
    assert.equal(region.name, "A");
    assert.equal(region.color, "#fff");
    assert.deepEqual(uvLayoutOf(region), kLayout);
  });
});
