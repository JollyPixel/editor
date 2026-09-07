// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { packNet } from "#src/uv/netLayout.ts";
import type { UVGeometry } from "#src/uv/types.ts";

function square(
  size: number
): UVGeometry {
  return { x: 0, y: 0, width: size, height: size };
}

function cells(
  count: number,
  size = 4
) {
  return Array.from({ length: count }, (_, index) => {
    return {
      face: `f${index}`,
      geometry: square(size)
    };
  });
}

function boundsOf(
  packed: ReadonlyMap<string, UVGeometry>
) {
  let width = 0;
  let height = 0;
  for (const geometry of packed.values()) {
    const rect = "shape" in geometry ? geometry.rect : geometry;
    width = Math.max(width, rect.x + rect.width);
    height = Math.max(height, rect.y + rect.height);
  }

  return { width, height };
}

describe("packNet", () => {
  test("returns nothing for an empty cell list", () => {
    assert.strictEqual(packNet([], { x: 0, y: 0 }).size, 0);
  });

  test("lays six equal faces out as a 2x3 net anchored on the origin", () => {
    const packed = packNet(cells(6), { x: 10, y: 20 });

    assert.deepStrictEqual(
      [...packed.entries()].map(([face, geometry]) => [face, geometry]),
      [
        ["f0", { x: 10, y: 20, width: 4, height: 4 }],
        ["f1", { x: 14, y: 20, width: 4, height: 4 }],
        ["f2", { x: 10, y: 24, width: 4, height: 4 }],
        ["f3", { x: 14, y: 24, width: 4, height: 4 }],
        ["f4", { x: 10, y: 28, width: 4, height: 4 }],
        ["f5", { x: 14, y: 28, width: 4, height: 4 }]
      ]
    );
  });

  test("leaves a hole in the last row when the count is not a full net", () => {
    const packed = packNet(cells(5), { x: 0, y: 0 });

    assert.deepStrictEqual(packed.get("f3"), { x: 4, y: 4, width: 4, height: 4 });
    assert.deepStrictEqual(packed.get("f4"), { x: 0, y: 8, width: 4, height: 4 });
    assert.strictEqual(packed.size, 5);
  });

  test("keeps a single face where it is", () => {
    const packed = packNet(cells(1), { x: 7, y: 3 });

    assert.deepStrictEqual(packed.get("f0"), { x: 7, y: 3, width: 4, height: 4 });
  });

  test("drops shorter cells beside a taller one instead of below it", () => {
    const packed = packNet(
      [
        { face: "a", geometry: { x: 0, y: 0, width: 2, height: 6 } },
        { face: "b", geometry: { x: 0, y: 0, width: 5, height: 3 } },
        { face: "c", geometry: { x: 0, y: 0, width: 4, height: 1 } },
        { face: "d", geometry: { x: 0, y: 0, width: 1, height: 1 } }
      ],
      { x: 0, y: 0 }
    );

    assert.deepStrictEqual(packed.get("a"), { x: 0, y: 0, width: 2, height: 6 });
    assert.deepStrictEqual(packed.get("b"), { x: 2, y: 0, width: 5, height: 3 });
    assert.deepStrictEqual(packed.get("c"), { x: 2, y: 3, width: 4, height: 1 });
    assert.deepStrictEqual(packed.get("d"), { x: 6, y: 3, width: 1, height: 1 });
  });

  test("pairs strips of unlike orientation into one compact net", () => {
    const packed = packNet(
      [
        { face: "front", geometry: { x: 0, y: 0, width: 4, height: 4 } },
        { face: "back", geometry: { x: 0, y: 0, width: 4, height: 4 } },
        { face: "left", geometry: { x: 0, y: 0, width: 16, height: 4 } },
        { face: "right", geometry: { x: 0, y: 0, width: 16, height: 4 } },
        { face: "top", geometry: { x: 0, y: 0, width: 4, height: 16 } },
        { face: "bottom", geometry: { x: 0, y: 0, width: 4, height: 16 } }
      ],
      { x: 0, y: 0 }
    );

    assert.deepStrictEqual(boundsOf(packed), { width: 24, height: 16 });
    assert.deepStrictEqual(packed.get("left"), { x: 8, y: 0, width: 16, height: 4 });
    assert.deepStrictEqual(packed.get("right"), { x: 8, y: 4, width: 16, height: 4 });
  });

  test("preserves a triangle's shape while repositioning it", () => {
    const packed = packNet(
      [
        { face: "a", geometry: square(4) },
        {
          face: "b",
          geometry: {
            shape: "triangle",
            corner: "bottom-right",
            rect: { x: 0, y: 0, width: 4, height: 4 }
          }
        }
      ],
      { x: 0, y: 0 }
    );

    assert.deepStrictEqual(packed.get("b"), {
      shape: "triangle",
      corner: "bottom-right",
      rect: { x: 0, y: 4, width: 4, height: 4 }
    });
  });

  test("is deterministic, so two peers pack an identical net", () => {
    const origin = { x: 3, y: 5 };

    assert.deepStrictEqual(
      [...packNet(cells(6), origin)],
      [...packNet(cells(6), origin)]
    );
  });
});
