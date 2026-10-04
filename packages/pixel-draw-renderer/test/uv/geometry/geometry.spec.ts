// Import Node.js Dependencies
import { test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { pointInGeometry } from "#src/uv/geometry/geometry.ts";
import type { UVGeometry } from "#src/uv/geometry/types.ts";
import type { Vec2 } from "#src/types.ts";

interface PointCase {
  name: string;
  point: Vec2;
  geometry: UVGeometry;
  expected: boolean;
}

test("pointInGeometry contains only a geometry's covered area", () => {
  const triangle: UVGeometry = {
    shape: "triangle",
    corner: "bottom-right",
    rect: { x: 0, y: 0, width: 8, height: 8 }
  };
  const stairSide: UVGeometry = {
    shape: "compound",
    rect: { x: 0, y: 0, width: 16, height: 16 },
    parts: [
      { x: 0, y: 0.5, width: 1, height: 0.5 },
      { x: 0.5, y: 0, width: 0.5, height: 0.5 }
    ]
  };
  const cases: PointCase[] = [
    {
      name: "triangle covered corner",
      point: { x: 7, y: 7 },
      geometry: triangle,
      expected: true
    },
    {
      name: "triangle open corner",
      point: { x: 1, y: 1 },
      geometry: triangle,
      expected: false
    },
    {
      name: "outside triangle bounds",
      point: { x: 100, y: 100 },
      geometry: triangle,
      expected: false
    },
    {
      name: "outside compound bounds",
      point: { x: 40, y: 2 },
      geometry: stairSide,
      expected: false
    }
  ];

  for (const { name, point, geometry, expected } of cases) {
    assert.strictEqual(pointInGeometry(point, geometry), expected, name);
  }
});
