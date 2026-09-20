// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { ScaleGesture } from "#src/transform-controls/gestures/ScaleGesture.ts";
import {
  assertClose,
  createContext,
  rayAt
} from "./context.ts";

// CONSTANTS
const kUnitScale = new THREE.Vector3(1, 1, 1);

describe("ScaleGesture", () => {
  test("scales one axis by the ratio of distances from the pivot", () => {
    const gesture = ScaleGesture.begin(
      createContext(
        { kind: "axis", axis: "x", direction: 1 },
        rayAt(1, 0)
      ),
      kUnitScale
    );
    assert.ok(gesture);

    const factor = new THREE.Vector3();
    assert.equal(gesture.update(rayAt(2.5, 0.4), null, factor), true);
    assert.deepEqual(factor.toArray(), [2.5, 1, 1]);
  });

  test("grows from a negative handle when dragged outwards", () => {
    const gesture = ScaleGesture.begin(
      createContext(
        { kind: "axis", axis: "x", direction: -1 },
        rayAt(-1, 0)
      ),
      kUnitScale
    );
    assert.ok(gesture);

    const factor = new THREE.Vector3();
    gesture.update(rayAt(-3, 0), null, factor);
    assertClose(factor.x, 3);
  });

  test("never collapses or mirrors when dragged through the pivot", () => {
    const gesture = ScaleGesture.begin(
      createContext(
        { kind: "axis", axis: "x", direction: 1 },
        rayAt(1, 0)
      ),
      kUnitScale
    );
    assert.ok(gesture);

    const factor = new THREE.Vector3();
    gesture.update(rayAt(-2, 0), null, factor);
    assert.ok(factor.x > 0);
    assert.ok(factor.x < 0.01);
  });

  test("snaps the resulting scale value, not the factor", () => {
    const gesture = ScaleGesture.begin(
      createContext(
        { kind: "axis", axis: "x", direction: 1 },
        rayAt(1, 0)
      ),
      new THREE.Vector3(2, 1, 1)
    );
    assert.ok(gesture);

    const factor = new THREE.Vector3();
    gesture.update(rayAt(1.2, 0), 0.5, factor);
    assertClose(factor.x * 2, 2.5);

    gesture.update(rayAt(0.01, 0), 0.5, factor);
    assertClose(factor.x * 2, 0.5);
  });

  test("scales both in-plane axes together", () => {
    const gesture = ScaleGesture.begin(
      createContext(
        { kind: "plane", normal: "z" },
        rayAt(1, 1)
      ),
      kUnitScale
    );
    assert.ok(gesture);

    const factor = new THREE.Vector3();
    gesture.update(rayAt(2, 2), null, factor);
    assertClose(factor.x, 2);
    assertClose(factor.y, 2);
    assertClose(factor.z, 1);
  });

  test("scales uniformly from the center along the screen diagonal", () => {
    const gesture = ScaleGesture.begin(
      createContext(
        { kind: "center" },
        rayAt(0, 0),
        { size: 2 }
      ),
      kUnitScale
    );
    assert.ok(gesture);

    const factor = new THREE.Vector3();
    const step = Math.SQRT2;
    gesture.update(rayAt(step, step), null, factor);
    assertClose(factor.x, 2);
    assertClose(factor.y, 2);
    assertClose(factor.z, 2);

    gesture.update(rayAt(-step / 2, -step / 2), null, factor);
    assertClose(factor.x, 0.5);
  });

  test("refuses an axis press on the pivot and the view ring", () => {
    assert.equal(
      ScaleGesture.begin(
        createContext(
          { kind: "axis", axis: "x", direction: 1 },
          rayAt(0, 0)
        ),
        kUnitScale
      ),
      null
    );
    assert.equal(
      ScaleGesture.begin(
        createContext({ kind: "view" }, rayAt(1, 0)),
        kUnitScale
      ),
      null
    );
  });
});
