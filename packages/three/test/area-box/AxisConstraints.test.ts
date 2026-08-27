// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { AxisConstraints } from "#src/area-box/AxisConstraints.ts";

describe("AxisConstraints.stepFor", () => {
  test("shares one step across every axis for a scalar snap", () => {
    const constraints = new AxisConstraints({ snap: 2 });

    assert.equal(constraints.stepFor("x"), 2);
    assert.equal(constraints.stepFor("y"), 2);
    assert.equal(constraints.stepFor("z"), 2);
  });

  test("reads the matching component for a per-axis snap", () => {
    const constraints = new AxisConstraints({
      snap: { x: 1, y: 4, z: 0.5 }
    });

    assert.equal(constraints.stepFor("x"), 1);
    assert.equal(constraints.stepFor("y"), 4);
    assert.equal(constraints.stepFor("z"), 0.5);
  });

  test("disables the step without a snap or in free mode", () => {
    assert.equal(new AxisConstraints().stepFor("x"), 0);
    assert.equal(new AxisConstraints({ snap: null }).stepFor("x"), 0);
    assert.equal(new AxisConstraints({ snap: 2 }).stepFor("x", true), 0);
  });
});

describe("AxisConstraints.snapOn", () => {
  test("rounds to the step of the axis", () => {
    const constraints = new AxisConstraints({
      snap: { x: 1, y: 4, z: 1 }
    });

    assert.equal(constraints.snapOn("x", 3.6), 4);
    assert.equal(constraints.snapOn("y", 3.6), 4);
    assert.equal(constraints.snapOn("y", 1.9), 0);
  });

  test("returns the value untouched in free mode", () => {
    const constraints = new AxisConstraints({ snap: 1 });

    assert.equal(constraints.snapOn("x", 3.6, true), 3.6);
  });
});

describe("AxisConstraints.minSizeFor", () => {
  test("takes minSize over the step", () => {
    const constraints = new AxisConstraints({
      snap: 4,
      minSize: { x: 0.25, y: 0.5, z: 3 }
    });

    assert.equal(constraints.minSizeFor("x"), 0.25);
    assert.equal(constraints.minSizeFor("z"), 3);
  });

  test("falls back to the step when minSize is absent", () => {
    const constraints = new AxisConstraints({
      snap: { x: 2, y: 0, z: 2 }
    });

    assert.equal(constraints.minSizeFor("x"), 2);
  });

  test("falls back to 1 without minSize nor a usable step", () => {
    assert.equal(new AxisConstraints().minSizeFor("x"), 1);
    assert.equal(
      new AxisConstraints({ snap: { x: 0, y: 0, z: 0 } }).minSizeFor("x"),
      1
    );
  });

  test("ignores free mode, which only applies to snapping", () => {
    const constraints = new AxisConstraints({ snap: 2 });

    assert.equal(constraints.minSizeFor("x"), 2);
  });
});

describe("AxisConstraints.rangeFor", () => {
  test("returns null when unbounded", () => {
    assert.equal(new AxisConstraints().rangeFor("x"), null);
  });

  test("slices the bounding box on the requested axis", () => {
    const constraints = new AxisConstraints({
      bounds: new THREE.Box3(
        new THREE.Vector3(-1, 0, 2),
        new THREE.Vector3(5, 10, 8)
      )
    });

    assert.deepEqual(constraints.rangeFor("x"), { min: -1, max: 5 });
    assert.deepEqual(constraints.rangeFor("y"), { min: 0, max: 10 });
    assert.deepEqual(constraints.rangeFor("z"), { min: 2, max: 8 });
  });

  test("reads the bounds live rather than a copy", () => {
    const bounds = new THREE.Box3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(4, 4, 4)
    );
    const constraints = new AxisConstraints({ bounds });

    bounds.max.setX(9);

    assert.deepEqual(constraints.rangeFor("x"), { min: 0, max: 9 });
  });
});
