// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { OUTLINE_NORMAL_ATTRIBUTE } from "#src/transform-controls/handles/materials.ts";
import { createOutlineGeometry } from "#src/transform-controls/handles/outline.ts";

function miters(
  geometry: THREE.BufferGeometry
): THREE.Vector3[] {
  const attribute = geometry.getAttribute(OUTLINE_NORMAL_ATTRIBUTE);

  return Array.from(
    { length: attribute.count },
    (_, index) => new THREE.Vector3().fromBufferAttribute(attribute, index)
  );
}

describe("createOutlineGeometry", () => {
  test("welds a box to its eight corners", () => {
    const outline = createOutlineGeometry(new THREE.BoxGeometry(1, 1, 1));

    assert.equal(outline.getAttribute("position").count, 8);
    assert.equal(outline.getAttribute("normal"), undefined);
  });

  test("offsets every face of a hard corner by the same distance", () => {
    const outline = createOutlineGeometry(new THREE.BoxGeometry(2, 1, 3));

    for (const miter of miters(outline)) {
      for (const axis of ["x", "y", "z"] as const) {
        assert.ok(
          Math.abs(Math.abs(miter[axis]) - 1) < 0.1,
          `expected a unit offset on ${axis}, received ${miter[axis]}`
        );
      }
    }
  });

  test("keeps unit radial offsets on a smooth surface", () => {
    const outline = createOutlineGeometry(new THREE.SphereGeometry(1, 24, 16));
    const position = outline.getAttribute("position");

    miters(outline).forEach((miter, index) => {
      const radial = new THREE.Vector3()
        .fromBufferAttribute(position, index)
        .normalize();

      assert.ok(Math.abs(miter.length() - 1) < 0.05);
      assert.ok(miter.dot(radial) > 0.98);
    });
  });

  test("limits the spike of a sharp tip", () => {
    const outline = createOutlineGeometry(new THREE.ConeGeometry(0.1, 2, 12));

    for (const miter of miters(outline)) {
      assert.ok(miter.length() <= 2 + 1e-6);
    }
  });
});
