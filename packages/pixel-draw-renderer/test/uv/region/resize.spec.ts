// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  UVRegion,
  type UVGeometry,
  type UVSlot
} from "#src/uv/region/UVRegion.ts";
import { rectOf } from "#src/uv/geometry/geometry.ts";
import type { SelectionRect } from "#src/types.ts";

function cell(
  column: number,
  row: number
): SelectionRect {
  return {
    x: 10 + column * 4,
    y: 10 + row * 4,
    width: 4,
    height: 4
  };
}

function unfolded(): UVRegion {
  return new UVRegion({
    id: "r1",
    color: "#f00",
    state: "unfolded",
    faces: {
      front: cell(0, 0),
      back: cell(1, 0),
      left: cell(2, 0),
      right: cell(0, 1),
      top: cell(1, 1),
      bottom: cell(2, 1)
    }
  });
}

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

function faces(
  region: UVRegion
): Record<UVSlot, UVGeometry> {
  return Object.fromEntries(
    region.slots.map((slot) => [slot, region.geometryFor(slot)])
  );
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

  describe("unfolded", () => {
    test("pushes the faces a growing face runs into", () => {
      const resized = unfolded().resized(
        {
          ...cell(1, 0),
          width: 7
        },
        "back"
      );

      assert.deepEqual(faces(resized), {
        front: cell(0, 0),
        back: {
          ...cell(1, 0),
          width: 7
        },
        left: {
          ...cell(2, 0),
          x: cell(2, 0).x + 3
        },
        right: cell(0, 1),
        top: cell(1, 1),
        bottom: cell(2, 1)
      });
    });

    test("passes a push on to the faces a pushed face reaches, and no further", () => {
      const region = new UVRegion({
        id: "r1",
        color: "#f00",
        state: "unfolded",
        faces: {
          front: { x: 0, y: 0, width: 4, height: 4 },
          back: { x: 0, y: 4, width: 4, height: 4 },
          left: { x: 4, y: 0, width: 4, height: 6 },
          right: { x: 8, y: 4, width: 4, height: 4 },
          top: { x: 4, y: 6, width: 4, height: 2 }
        }
      });

      const resized = region.resized(
        { x: 0, y: 0, width: 6, height: 4 },
        "front"
      );

      assert.deepEqual(faces(resized), {
        front: { x: 0, y: 0, width: 6, height: 4 },
        back: { x: 0, y: 4, width: 4, height: 4 },
        left: { x: 6, y: 0, width: 4, height: 6 },
        right: { x: 10, y: 4, width: 4, height: 4 },
        top: { x: 4, y: 6, width: 4, height: 2 }
      });
    });

    test("leaves a face out of contact in place until the edge reaches it", () => {
      const region = new UVRegion({
        id: "r1",
        color: "#f00",
        state: "unfolded",
        faces: {
          front: { x: 0, y: 0, width: 4, height: 4 },
          back: { x: 8, y: 0, width: 4, height: 4 }
        }
      });

      assert.deepEqual(
        region.resized({ x: 0, y: 0, width: 6, height: 4 }, "front").geometryFor("back"),
        { x: 8, y: 0, width: 4, height: 4 }
      );
      assert.deepEqual(
        region.resized({ x: 0, y: 0, width: 10, height: 4 }, "front").geometryFor("back"),
        { x: 10, y: 0, width: 4, height: 4 }
      );
    });

    test("stops a pulled face where it would hit a face that stays", () => {
      const region = new UVRegion({
        id: "r1",
        color: "#f00",
        state: "unfolded",
        faces: {
          front: { x: 0, y: 0, width: 4, height: 4 },
          right: { x: 0, y: 4, width: 4, height: 4 },
          back: { x: 4, y: 0, width: 4, height: 8 }
        }
      });

      const resized = region.resized({ x: 0, y: 0, width: 2, height: 4 }, "front");

      assert.deepEqual(resized.geometryFor("back"), { x: 4, y: 0, width: 4, height: 8 });
    });

    test("moves an aligned row's bottom edge together", () => {
      const resized = unfolded().resized(
        {
          ...cell(0, 0),
          height: 6
        },
        "front",
        { aligned: true }
      );

      assert.deepEqual(faces(resized), {
        front: { ...cell(0, 0), height: 6 },
        back: { ...cell(1, 0), height: 6 },
        left: { ...cell(2, 0), height: 6 },
        right: { ...cell(0, 1), y: cell(0, 1).y + 2 },
        top: { ...cell(1, 1), y: cell(1, 1).y + 2 },
        bottom: { ...cell(2, 1), y: cell(2, 1).y + 2 }
      });
    });

    test("stops an aligned edge at a face whose edge is off the line", () => {
      const region = new UVRegion({
        id: "r1",
        color: "#f00",
        state: "unfolded",
        faces: {
          front: { x: 0, y: 0, width: 4, height: 4 },
          back: { x: 4, y: 0, width: 4, height: 6 },
          left: { x: 8, y: 0, width: 4, height: 4 }
        }
      });

      const resized = region.resized(
        { x: 0, y: 0, width: 4, height: 5 },
        "front",
        { aligned: true }
      );

      assert.deepEqual(faces(resized), {
        front: { x: 0, y: 0, width: 4, height: 5 },
        back: { x: 4, y: 0, width: 4, height: 6 },
        left: { x: 8, y: 0, width: 4, height: 4 }
      });
    });

    test("pushes faces away from a moved north-west corner", () => {
      const resized = unfolded().resized(
        {
          x: cell(1, 1).x - 2,
          y: cell(1, 1).y - 1,
          width: 6,
          height: 5
        },
        "top"
      );

      assert.deepEqual(faces(resized), {
        front: {
          ...cell(0, 0),
          y: cell(0, 0).y - 1
        },
        back: {
          ...cell(1, 0),
          y: cell(1, 0).y - 1
        },
        left: cell(2, 0),
        right: {
          ...cell(0, 1),
          x: cell(0, 1).x - 2
        },
        top: {
          x: cell(1, 1).x - 2,
          y: cell(1, 1).y - 1,
          width: 6,
          height: 5
        },
        bottom: cell(2, 1)
      });
    });

    test("pulls back only the face that touched a shrinking edge", () => {
      const resized = unfolded().resized(
        {
          ...cell(0, 0),
          height: 2
        },
        "front"
      );

      assert.deepEqual(resized.geometryFor("right"), {
        ...cell(0, 1),
        y: cell(0, 1).y - 2
      });
      for (const [slot, column] of [["top", 1], ["bottom", 2]] as const) {
        assert.deepEqual(resized.geometryFor(slot), cell(column, 1));
      }
    });
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
