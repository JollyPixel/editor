// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  UVRegion,
  DEFAULT_UV_SLOTS
} from "#src/uv/region/UVRegion.ts";
import {
  REGION_RECT,
  makeStacked,
  makeFree
} from "../../helpers/uv/region.ts";

describe("UVRegion", () => {
  describe("stack", () => {
    test("keeps the front face by default and ignores a requested face smaller than the largest one", () => {
      const moved = makeFree()
        .resized({ x: 9, y: 9, width: 1, height: 1 }, "top");

      for (const stacked of [moved.stack(), moved.stack("top")]) {
        assert.strictEqual(stacked.state, "stacked");
        assert.strictEqual(stacked.stackedFace, "front");
        assert.deepStrictEqual(stacked.rectFor("front"), REGION_RECT);
        assert.deepStrictEqual(
          stacked.rectFor("top"),
          REGION_RECT,
          "a partial slot must not become the shared rectangle"
        );
      }
    });

    test("returns the same instance when already stacked", () => {
      const region = makeStacked();

      assert.strictEqual(region.stack(), region);
    });

    test("prefers a rectangle among equally large faces", () => {
      const region = new UVRegion({
        id: "r1",
        color: "#f00",
        state: "free",
        activeFaces: ["left", "top"],
        faces: {
          front: REGION_RECT,
          back: REGION_RECT,
          left: { shape: "triangle", corner: "top-right", rect: REGION_RECT },
          right: REGION_RECT,
          top: { ...REGION_RECT, x: 9, y: 9 },
          bottom: REGION_RECT
        }
      });

      const stacked = region.stack("left");

      assert.strictEqual(stacked.stackedFace, "top");
      assert.deepStrictEqual(stacked.rectFor("front"), { ...REGION_RECT, x: 9, y: 9 });
    });

    test("stacks onto the largest face, not the first one", () => {
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

      const stacked = pole.stack();

      assert.strictEqual(stacked.stackedFace, "left");
      assert.deepStrictEqual(stacked.rectFor("front"), {
        x: 0, y: 6, width: 16, height: 4
      });
    });

    test("honours an explicitly requested stack face", () => {
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

      const stacked = pole.stack("top");
      const topRect = { x: 6, y: 0, width: 4, height: 16 };

      assert.strictEqual(stacked.stackedFace, "top");
      for (const face of DEFAULT_UV_SLOTS) {
        assert.deepStrictEqual(
          stacked.rectFor(face),
          topRect,
          `${face} must adopt the requested face rect`
        );
      }
    });
  });
});
