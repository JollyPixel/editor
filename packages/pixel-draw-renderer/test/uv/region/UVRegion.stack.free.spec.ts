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
import { REGION_RECT } from "../../helpers/uv/region.ts";

describe("UVRegion", () => {
  describe("stack", () => {
    test("restores triangle topology after stacking and freeing", () => {
      const ramp = new UVRegion({
        id: "r1",
        color: "#f00",
        state: "free",
        activeFaces: ["back", "left", "right", "top", "bottom"],
        faces: {
          front: REGION_RECT,
          back: REGION_RECT,
          left: { shape: "triangle", corner: "top-right", rect: REGION_RECT },
          right: { shape: "triangle", corner: "top-right", rect: REGION_RECT },
          top: REGION_RECT,
          bottom: REGION_RECT
        }
      });

      const restored = ramp.stack().free();

      assert.deepStrictEqual(restored.slotsOf().map(({ slot }) => slot), [
        "back", "left", "right", "top", "bottom"
      ]);
      assert.deepStrictEqual(restored.geometryFor("left"), {
        shape: "triangle", corner: "top-right", rect: REGION_RECT
      });
    });

    test("keeps each retained face's own size across a stack round-trip", () => {
      const ramp = new UVRegion({
        id: "r1",
        color: "#f00",
        state: "free",
        activeFaces: ["back", "left", "right", "top", "bottom"],
        faces: {
          front: REGION_RECT,
          back: REGION_RECT,
          left: {
            shape: "triangle",
            corner: "top-right",
            rect: { x: 9, y: 9, width: 1, height: 1 }
          },
          right: { shape: "triangle", corner: "top-right", rect: REGION_RECT },
          top: REGION_RECT,
          bottom: REGION_RECT
        }
      });

      const smallLeft = { ...REGION_RECT, width: 1, height: 1 };
      const restored = ramp.stack().free();

      assert.deepStrictEqual(restored.rectFor("left"), smallLeft);
      assert.deepStrictEqual(restored.geometryFor("left"), {
        shape: "triangle", corner: "top-right", rect: smallLeft
      });
      assert.deepStrictEqual(restored.rectFor("back"), REGION_RECT);
    });

    test("resets moved faces onto the shared rectangle", () => {
      const region = new UVRegion({
        id: "r1",
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
      });

      const restored = region
        .movedTo({ x: 40, y: 30 }, "top")
        .stack()
        .free();

      for (const face of DEFAULT_UV_SLOTS) {
        assert.deepStrictEqual(
          restored.rectFor(face),
          REGION_RECT,
          `${face} must restart on the region's rect`
        );
      }
    });

    test("resets moved faces when the stacked region moved too", () => {
      const region = new UVRegion({
        id: "r1",
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
      });

      const moved = { ...REGION_RECT, x: 20, y: 10 };
      const restored = region
        .movedTo({ x: 40, y: 30 }, "top")
        .stack()
        .movedTo(moved)
        .free();

      for (const face of DEFAULT_UV_SLOTS) {
        assert.deepStrictEqual(
          restored.rectFor(face),
          moved,
          `${face} must follow the region instead of replaying its old offset`
        );
      }
    });

    test("keeps each face's own size when the stacked region moved", () => {
      const region = new UVRegion({
        id: "r1",
        color: "#f00",
        state: "free",
        faces: {
          front: { x: 0, y: 0, width: 4, height: 4 },
          back: { x: 0, y: 0, width: 4, height: 4 },
          left: { x: 0, y: 0, width: 16, height: 4 },
          right: { x: 0, y: 0, width: 16, height: 4 },
          top: { x: 0, y: 0, width: 4, height: 16 },
          bottom: { x: 0, y: 0, width: 4, height: 16 }
        }
      });

      const stacked = region.stack();
      const moved = stacked.movedTo({
        ...stacked.rectFor("front"),
        x: stacked.rectFor("front").x + 20,
        y: stacked.rectFor("front").y + 10
      });
      const restored = moved.free();

      assert.deepStrictEqual(restored.rectFor("front"), {
        x: 20, y: 10, width: 4, height: 4
      });
      assert.deepStrictEqual(restored.rectFor("top"), {
        x: 20, y: 10, width: 4, height: 16
      });
    });
  });
});
