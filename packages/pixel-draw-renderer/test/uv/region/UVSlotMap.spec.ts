// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { UVSlotMap } from "#src/uv/region/UVSlotMap.ts";
import {
  DEFAULT_UV_SLOTS,
  type UVGeometry
} from "#src/uv/region/UVRegion.ts";
import type { SelectionRect } from "#src/types.ts";

// CONSTANTS
const kRect: SelectionRect = { x: 1, y: 2, width: 3, height: 4 };
const kTriangle: UVGeometry = {
  shape: "triangle",
  corner: "top-right",
  rect: kRect
};

function fullRecord(
  geometry: UVGeometry = kRect
): Record<string, UVGeometry> {
  return Object.fromEntries(DEFAULT_UV_SLOTS.map((face) => [face, geometry]));
}

describe("UVSlotMap", () => {
  describe("constructor", () => {
    test("rejects an empty slot map", () => {
      assert.throws(
        () => new UVSlotMap({}),
        RangeError
      );
    });

    test("copies incoming geometry instead of aliasing it", () => {
      const rect = { ...kRect };
      const faces = new UVSlotMap(fullRecord(rect) as Record<string, UVGeometry> as never);
      rect.x = 99;

      assert.strictEqual((faces.get("front") as SelectionRect).x, kRect.x);
    });
  });

  describe("get()", () => {
    test("rejects an unknown slot instead of substituting another", () => {
      assert.throws(
        () => UVSlotMap.shared(kRect).get("missing"),
        RangeError
      );
    });
  });

  describe("withSlot()", () => {
    test("rejects an unknown slot", () => {
      assert.throws(
        () => UVSlotMap.shared(kRect).withSlot("missing", kRect),
        RangeError
      );
    });
  });

  describe("translated()", () => {
    test("keeps every slot with its own size and offset", () => {
      const faces = new UVSlotMap({
        ...fullRecord(),
        front: { x: 0, y: 0, width: 4, height: 4 },
        top: { x: 10, y: 20, width: 16, height: 2 },
        "top.1": { x: 2, y: 0, width: 1, height: 1 }
      }).translated(5, 5);

      assert.deepStrictEqual(faces.slots, [...DEFAULT_UV_SLOTS, "top.1"]);
      assert.deepStrictEqual(faces.get("front"), {
        x: 5, y: 5, width: 4, height: 4
      });
      assert.deepStrictEqual(faces.get("top"), {
        x: 15, y: 25, width: 16, height: 2
      });
      assert.deepStrictEqual(faces.get("back"), {
        x: kRect.x + 5, y: kRect.y + 5, width: kRect.width, height: kRect.height
      });
      assert.deepStrictEqual(faces.get("top.1"), {
        x: 7, y: 5, width: 1, height: 1
      });
    });

    test("preserves triangle shape metadata while moving its bounds", () => {
      const faces = new UVSlotMap(fullRecord(kTriangle) as Record<string, UVGeometry> as never);
      const moved = faces.translated(8, 7);

      assert.deepStrictEqual(moved.get("left"), {
        shape: "triangle",
        corner: "top-right",
        rect: {
          x: kRect.x + 8,
          y: kRect.y + 7,
          width: kRect.width,
          height: kRect.height
        }
      });
    });
  });

  describe("toJSON()", () => {
    test("returns copies the caller cannot use to mutate the map", () => {
      const faces = UVSlotMap.shared(kRect);
      const data = faces.toJSON();
      (data.front as SelectionRect).x = 99;

      assert.strictEqual((faces.get("front") as SelectionRect).x, kRect.x);
    });
  });
});
