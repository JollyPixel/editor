// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { UVRegion } from "#src/uv/region/UVRegion.ts";
import { REGION_RECT } from "../../helpers/uv/region.ts";

describe("UVRegion", () => {
  describe("stack", () => {
    test("serializes retained faces even when no face is triangular", () => {
      const pole = new UVRegion({
        id: "p1",
        color: "#f00",
        state: "free",
        faces: {
          front: { x: 6, y: 6, width: 4, height: 4 },
          back: { x: 6, y: 6, width: 4, height: 4 },
          left: { x: 0, y: 6, width: 16, height: 4 },
          right: { x: 0, y: 6, width: 16, height: 4 },
          top: { x: 6, y: 0, width: 4, height: 16 },
          bottom: { x: 6, y: 0, width: 4, height: 16 }
        }
      });

      const data = pole.stack().toJSON();
      const restored = UVRegion.from(data).free();

      assert.strictEqual(data.state === "stacked" ? data.stackedFace : null, "left");
      assert.deepStrictEqual(restored.rectFor("front"), {
        x: 0, y: 6, width: 4, height: 4
      });
      assert.deepStrictEqual(restored.rectFor("top"), {
        x: 0, y: 6, width: 4, height: 16
      });
    });

    test("omits retained faces when they all match the shared rect", () => {
      const data = new UVRegion({
        id: "c1",
        color: "#f00",
        state: "free",
        faces: {
          front: REGION_RECT,
          back: REGION_RECT,
          left: REGION_RECT,
          right: REGION_RECT,
          top: REGION_RECT,
          bottom: REGION_RECT
        }
      }).stack().toJSON();

      assert.deepStrictEqual(Object.keys(data).sort(), [
        "color", "id", "rect", "state"
      ]);
    });
  });
});
