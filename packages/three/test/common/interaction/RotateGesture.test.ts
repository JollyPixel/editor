// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  RotateGesture,
  type RotateGestureOptions
} from "#src/common/interaction/RotateGesture.ts";
import { assertClose } from "../../transform-controls/harness.ts";
import { rayAt } from "../../transform-controls/gestures/context.ts";

function begin(
  axis: [number, number, number],
  ray: THREE.Ray,
  overrides: Partial<RotateGestureOptions> = {}
): RotateGesture | null {
  return RotateGesture.begin({
    ray,
    axis: new THREE.Vector3(...axis),
    origin: new THREE.Vector3(),
    eye: new THREE.Vector3(0, 0, 1),
    radius: 1,
    ...overrides
  });
}

describe("RotateGesture", () => {
  test("measures the true angle around a ring facing the camera", () => {
    const gesture = begin([0, 0, 1], rayAt(1, 0));
    assert.ok(gesture);

    assert.equal(gesture.angular, true);
    assertClose(gesture.update(rayAt(0, 1), null)!, Math.PI / 2);
    assertClose(gesture.update(rayAt(0, -3), null)!, -Math.PI / 2);
  });

  test("falls back to a screen tangent scaled by the radius when the ring is edge-on", () => {
    const gesture = begin([0, 1, 0], rayAt(0, 0), { radius: 2 });
    assert.ok(gesture);

    assert.equal(gesture.angular, false);
    assertClose(gesture.update(rayAt(1, 0.7), null)!, 0.5);
    assertClose(gesture.update(rayAt(-3, 0), null)!, -1.5);
  });

  test("snaps the measured angle", () => {
    const gesture = begin([0, 0, 1], rayAt(1, 0));
    assert.ok(gesture);

    assertClose(gesture.update(rayAt(1, 1.2), Math.PI / 2)!, Math.PI / 2);
  });

  test("refuses a press on the rotation center", () => {
    assert.equal(begin([0, 0, 1], rayAt(0, 0)), null);
  });
});
