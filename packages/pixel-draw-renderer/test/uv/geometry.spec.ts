// Import Node.js Dependencies
import { test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { pointInGeometry } from "#src/uv/geometry.ts";

test("pointInGeometry contains only a triangle's covered area", () => {
  const triangle = {
    shape: "triangle",
    corner: "bottom-right",
    rect: { x: 0, y: 0, width: 8, height: 8 }
  } as const;

  assert.ok(pointInGeometry({ x: 7, y: 7 }, triangle));
  assert.ok(!pointInGeometry({ x: 1, y: 1 }, triangle));
  assert.ok(!pointInGeometry({ x: 100, y: 100 }, triangle));
});
