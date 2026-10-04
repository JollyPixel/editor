// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { UVRegion } from "#src/uv/region/UVRegion.ts";
import { rectOf } from "#src/uv/geometry/geometry.ts";
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
      for (const { geometry } of resized.unfold().slotsOf()) {
        assert.deepEqual(
          [rectOf(geometry).width, rectOf(geometry).height],
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

      assert.deepEqual(region.geometryFor("front"), {
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

    assert.deepEqual(resized.geometryFor("top"), {
      x: 1,
      y: 1,
      width: 3,
      height: 9,
      rotation: 1
    });
    assert.deepEqual(resized.geometryFor("front"), region.geometryFor("front"));
  });

  test("ignores regions with a non-rectangular face", () => {
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

    assert.equal(region.resizable, false);
    assert.equal(
      region.resized(
        {
          ...cell(0, 0),
          width: 8
        },
        "front"
      ),
      region
    );
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
