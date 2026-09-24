// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { createAxisHandleGeometry } from "#src/transform-controls/handles/geometry.ts";

function boundsOf(
  geometry: THREE.BufferGeometry
): THREE.Box3 {
  geometry.computeBoundingBox();

  return geometry.boundingBox!;
}

describe("createAxisHandleGeometry", () => {
  test("a slab tip is a square face, half as deep as it is wide by default", () => {
    const { geometry, length } = createAxisHandleGeometry({
      kind: "slab",
      shaftLength: 1,
      size: 0.2
    });
    const bounds = boundsOf(geometry);

    assert.ok(Math.abs((bounds.max.x - bounds.min.x) - 0.2) < 1e-6);
    assert.ok(Math.abs((bounds.max.z - bounds.min.z) - 0.2) < 1e-6);
    assert.ok(Math.abs(bounds.max.y - 1.05) < 1e-6);
    assert.ok(Math.abs(length - 1.05) < 1e-6);
  });

  test("a slab tip honors an explicit depth", () => {
    const { geometry, length } = createAxisHandleGeometry({
      kind: "slab",
      shaftLength: 1,
      size: 0.2,
      depth: 0.04
    });

    assert.ok(Math.abs(boundsOf(geometry).max.y - 1.02) < 1e-6);
    assert.ok(Math.abs(length - 1.02) < 1e-6);
  });

  test("rejects a non-positive slab depth", () => {
    assert.throws(() => createAxisHandleGeometry({
      kind: "slab",
      depth: 0
    }));
  });
});
