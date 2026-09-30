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
import { assertClose } from "./harness.ts";

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

    assertClose(bounds.max.x - bounds.min.x, 0.2, "width");
    assertClose(bounds.max.z - bounds.min.z, 0.2, "breadth");
    assertClose(bounds.max.y, 1.05, "tip");
    assertClose(length, 1.05, "length");
  });

  test("a slab tip honors an explicit depth", () => {
    const { geometry, length } = createAxisHandleGeometry({
      kind: "slab",
      shaftLength: 1,
      size: 0.2,
      depth: 0.04
    });

    assertClose(boundsOf(geometry).max.y, 1.02, "tip");
    assertClose(length, 1.02, "length");
  });

  test("a sphere tip ends one radius past the shaft", () => {
    const { geometry, length } = createAxisHandleGeometry({
      kind: "sphere",
      shaftLength: 1,
      radius: 0.1
    });
    const bounds = boundsOf(geometry);

    assertClose(bounds.max.x - bounds.min.x, 0.2, "width");
    assertClose(bounds.max.y, 1.1, "tip");
    assertClose(length, 1.1, "length");
  });

  test("rejects a non-positive slab depth", () => {
    assert.throws(
      () => createAxisHandleGeometry({
        kind: "slab",
        depth: 0
      }),
      {
        name: "RangeError",
        message: /depth/
      }
    );
  });
});
