// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { UVRegion } from "#src/uv/region/UVRegion.ts";
import { boundingRect } from "#src/uv/geometry/geometry.ts";
import {
  cell,
  unfolded
} from "../../helpers/uv/resize.ts";

function stacked(): UVRegion {
  return new UVRegion({
    id: "r1",
    color: "#f00",
    state: "stacked",
    rect: {
      x: 0,
      y: 0,
      width: 4,
      height: 4
    }
  });
}

describe("UVRegion.resized", () => {
  describe("stacked", () => {
    test("resets every face to the new stack rect", () => {
      const rect = {
        x: 2,
        y: 3,
        width: 6,
        height: 5
      };
      const resized = stacked().resized(rect);

      assert.deepEqual(resized.bounds, rect);
      for (const { geometry } of resized.unfold().listSlots()) {
        assert.deepEqual(
          [boundingRect(geometry).width, boundingRect(geometry).height],
          [6, 5]
        );
      }
    });

    test("keeps the stack rotation", () => {
      const region = stacked()
        .rotated("cw")
        .resized({
          x: 0,
          y: 0,
          width: 2,
          height: 7
        });

      assert.deepEqual(region.slotGeometry("front"), {
        x: 0,
        y: 0,
        width: 2,
        height: 7,
        rotation: 1
      });
    });
  });

  test("resizes one free slot and keeps its rotation", () => {
    const region = stacked().free().rotated("cw", "top");
    const resized = region.resized(
      {
        x: 1,
        y: 1,
        width: 3,
        height: 9
      },
      "top"
    );

    assert.deepEqual(resized.slotGeometry("top"), {
      x: 1,
      y: 1,
      width: 3,
      height: 9,
      rotation: 1
    });
    assert.deepEqual(resized.slotGeometry("front"), region.slotGeometry("front"));
  });

  test("resizes a free triangle slot, keeping its corner", () => {
    const region = new UVRegion({
      id: "r1",
      color: "#f00",
      state: "free",
      faces: {
        front: cell(0, 0),
        left: {
          shape: "triangle",
          rect: cell(1, 0),
          corner: "top-left"
        }
      }
    });
    const rect = {
      ...cell(1, 0),
      width: 8
    };

    assert.deepEqual(region.resized(rect, "left").slotGeometry("left"), {
      shape: "triangle",
      rect,
      corner: "top-left"
    });
  });

  test("keeps the parts of a stacked compound face, scaled to the new stack rect", () => {
    const parts = [
      {
        shape: "triangle" as const,
        rect: { x: 0, y: 0, width: 0.5, height: 1 },
        corner: "bottom-right" as const
      },
      {
        shape: "triangle" as const,
        rect: { x: 0.5, y: 0, width: 0.5, height: 1 },
        corner: "bottom-left" as const
      }
    ];
    const region = new UVRegion({
      id: "r1",
      color: "#f00",
      state: "stacked",
      rect: cell(0, 0),
      faces: {
        side: { shape: "compound", rect: cell(0, 0), parts },
        bottom: cell(0, 0)
      }
    });
    const rect = { x: 2, y: 3, width: 6, height: 10 };

    const resized = region.resized(rect);

    assert.deepEqual(resized.unfold().listSlots().map(({ slot, geometry }) => [slot, "shape" in geometry]), [
      ["side", true],
      ["bottom", false]
    ]);
    assert.deepEqual(resized.toLayout().faces?.side, { shape: "compound", rect, parts });
  });

  test("ignores an inactive slot", () => {
    const region = new UVRegion({
      ...unfolded().toJSON(),
      activeFaces: ["front"]
    });

    assert.equal(
      region.resized(
        {
          ...cell(1, 0),
          width: 8
        },
        "back"
      ),
      region
    );
  });

  test("rejects a size below one pixel", () => {
    assert.throws(
      () => stacked().resized({
        x: 0,
        y: 0,
        width: 0,
        height: 4
      }),
      RangeError
    );
  });
});
