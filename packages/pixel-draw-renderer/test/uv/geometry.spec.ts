// Import Node.js Dependencies
import { test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { UVFaceSet, UVGeometryValue } from "#src/uv/geometry.ts";

test("UVGeometryValue contains only its triangular area", () => {
  const triangle = new UVGeometryValue({
    shape: "triangle",
    corner: "bottom-right",
    rect: { x: 0, y: 0, width: 8, height: 8 }
  });

  assert.ok(triangle.contains({ x: 7, y: 7 }));
  assert.ok(!triangle.contains({ x: 1, y: 1 }));
  assert.ok(!triangle.contains({ x: 100, y: 100 }));
});

test("UVFaceSet resets bounds without flattening triangle geometry", () => {
  const faces = UVFaceSet.shared({ x: 0, y: 0, width: 8, height: 8 })
    .withBounds("left", { x: 4, y: 4, width: 4, height: 4 });

  assert.deepStrictEqual(faces.get("left").bounds, { x: 4, y: 4, width: 4, height: 4 });
});
