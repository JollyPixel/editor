// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  copyGeometry,
  geometryAt,
  rectOf,
  rotateCorner,
  rotateGeometry,
  rotateUv
} from "#src/uv/geometry/geometry.ts";
import type { UVGeometry } from "#src/uv/region/UVRegion.ts";
import { isUVGeometry, isUVRegionData } from "#src/uv/region/validation.ts";

function turned(
  geometry: UVGeometry,
  times: number
): UVGeometry {
  let result = geometry;
  for (let index = 0; index < times; index++) {
    result = rotateGeometry(result, 1);
  }

  return result;
}

describe("UV rotation geometry", () => {
  test("a rect keeps its top-left corner and swaps its size", () => {
    const rotated = rotateGeometry({ x: 2, y: 3, width: 16, height: 8 }, 1);

    assert.deepStrictEqual(rotated, {
      x: 2,
      y: 3,
      width: 8,
      height: 16,
      rotation: 1
    });
  });

  test("negative turns wrap to the matching clockwise rotation", () => {
    const rotated = rotateGeometry({ x: 0, y: 0, width: 4, height: 2 }, -1);

    assert.strictEqual(rotated.rotation, 3);
    assert.deepStrictEqual(rectOf(rotated), { x: 0, y: 0, width: 2, height: 4 });
  });

  test("four turns restore every geometry kind and drop the rotation field", () => {
    const geometries: UVGeometry[] = [
      { x: 1, y: 2, width: 16, height: 8 },
      {
        shape: "triangle",
        corner: "bottom-right",
        rect: { x: 0, y: 0, width: 16, height: 23 }
      },
      {
        shape: "compound",
        rect: { x: 0, y: 0, width: 16, height: 16 },
        parts: [
          { x: 0, y: 0.5, width: 1, height: 0.5 },
          {
            shape: "triangle",
            corner: "top-left",
            rect: { x: 0, y: 0, width: 0.5, height: 0.5 }
          }
        ]
      }
    ];

    for (const geometry of geometries) {
      assert.deepStrictEqual(turned(geometry, 4), geometry);
    }
  });

  test("triangle corners turn clockwise", () => {
    assert.strictEqual(rotateCorner("top-left", 1), "top-right");
    assert.strictEqual(rotateCorner("top-right", 1), "bottom-right");
    assert.strictEqual(rotateCorner("bottom-right", 1), "bottom-left");
    assert.strictEqual(rotateCorner("bottom-left", 1), "top-left");
    assert.strictEqual(rotateCorner("top-left", -1), "bottom-left");
  });

  test("compound parts turn inside the unit square", () => {
    const rotated = rotateGeometry({
      shape: "compound",
      rect: { x: 0, y: 0, width: 16, height: 8 },
      parts: [
        { x: 0, y: 0, width: 0.5, height: 1 },
        {
          shape: "triangle",
          corner: "bottom-right",
          rect: { x: 0.5, y: 0, width: 0.5, height: 1 }
        }
      ]
    }, 1);

    assert.deepStrictEqual(rotated, {
      shape: "compound",
      rect: { x: 0, y: 0, width: 8, height: 16 },
      parts: [
        { x: 0, y: 0, width: 1, height: 0.5 },
        {
          shape: "triangle",
          corner: "bottom-left",
          rect: { x: 0, y: 0.5, width: 1, height: 0.5 }
        }
      ],
      rotation: 1
    });
  });

  test("rotateUv sends the face top edge to the rect right edge on a clockwise turn", () => {
    assert.deepStrictEqual(rotateUv(0, 1, 1), [1, 1]);
    assert.deepStrictEqual(rotateUv(1, 1, 1), [1, 0]);
    assert.deepStrictEqual(rotateUv(0, 0, 1), [0, 1]);
    assert.deepStrictEqual(rotateUv(0.25, 0.75, 4), [0.25, 0.75]);
    assert.deepStrictEqual(rotateUv(0, 1, -1), rotateUv(0, 1, 3));
  });

  test("copies and moves keep the rotation, rectOf drops it", () => {
    const geometry: UVGeometry = { x: 0, y: 0, width: 4, height: 8, rotation: 3 };

    assert.deepStrictEqual(copyGeometry(geometry), geometry);
    assert.deepStrictEqual(
      geometryAt(geometry, { x: 5, y: 6, width: 4, height: 8 }),
      { x: 5, y: 6, width: 4, height: 8, rotation: 3 }
    );
    assert.deepStrictEqual(rectOf(geometry), { x: 0, y: 0, width: 4, height: 8 });
  });

  test("validation accepts quarter turns only", () => {
    const rect = { x: 0, y: 0, width: 4, height: 4 };

    assert.ok(isUVGeometry({ ...rect, rotation: 2 }));
    assert.ok(!isUVGeometry({ ...rect, rotation: 4 }));
    assert.ok(!isUVGeometry({ ...rect, rotation: 1.5 }));
    assert.ok(isUVRegionData({
      id: "a",
      color: "#f00",
      state: "stacked",
      rect: { ...rect, rotation: 1 }
    }));
    assert.ok(!isUVRegionData({
      id: "a",
      color: "#f00",
      state: "stacked",
      rect: { ...rect, rotation: -1 }
    }));
  });
});
