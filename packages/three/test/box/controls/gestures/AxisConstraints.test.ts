// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { AxisConstraints } from "#src/box/controls/gestures/AxisConstraints.ts";

describe("AxisConstraints.axisStep", () => {
  test("shares one step across every axis for a scalar snap", () => {
    const constraints = new AxisConstraints({ snap: 2 });

    assert.equal(constraints.axisStep("x"), 2);
    assert.equal(constraints.axisStep("y"), 2);
    assert.equal(constraints.axisStep("z"), 2);
  });

  test("reads the matching component for a per-axis snap", () => {
    const constraints = new AxisConstraints({
      snap: { x: 1, y: 4, z: 0.5 }
    });

    assert.equal(constraints.axisStep("x"), 1);
    assert.equal(constraints.axisStep("y"), 4);
    assert.equal(constraints.axisStep("z"), 0.5);
  });

  test("disables the step without a snap or in free mode", () => {
    assert.equal(new AxisConstraints().axisStep("x"), 0);
    assert.equal(new AxisConstraints({ snap: null }).axisStep("x"), 0);
    assert.equal(new AxisConstraints({ snap: 2 }).axisStep("x", true), 0);
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
});

describe("AxisConstraints.axisMinSize", () => {
  test("takes minSize over the step", () => {
    const constraints = new AxisConstraints({
      snap: 4,
      minSize: { x: 0.25, y: 0.5, z: 3 }
    });

    assert.equal(constraints.axisMinSize("x"), 0.25);
    assert.equal(constraints.axisMinSize("z"), 3);
  });

  test("falls back to the step when minSize is absent", () => {
    const constraints = new AxisConstraints({
      snap: { x: 2, y: 0, z: 2 }
    });

    assert.equal(constraints.axisMinSize("x"), 2);
  });

  test("falls back to 1 without minSize nor a usable step", () => {
    assert.equal(new AxisConstraints().axisMinSize("x"), 1);
    assert.equal(
      new AxisConstraints({ snap: { x: 0, y: 0, z: 0 } }).axisMinSize("x"),
      1
    );
  });
});

describe("AxisConstraints.axisRange", () => {
  test("slices the bounding box on the requested axis", () => {
    const constraints = new AxisConstraints({
      bounds: new THREE.Box3(
        new THREE.Vector3(-1, 0, 2),
        new THREE.Vector3(5, 10, 8)
      )
    });

    assert.deepEqual(constraints.axisRange("x"), { min: -1, max: 5 });
    assert.deepEqual(constraints.axisRange("y"), { min: 0, max: 10 });
    assert.deepEqual(constraints.axisRange("z"), { min: 2, max: 8 });
  });
});
