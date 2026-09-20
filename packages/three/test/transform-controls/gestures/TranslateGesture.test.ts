// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { TranslateGesture } from "#src/transform-controls/gestures/TranslateGesture.ts";
import {
  assertClose,
  createContext,
  rayAt
} from "./context.ts";

describe("TranslateGesture", () => {
  test("keeps only the dragged axis and snaps the travelled distance", () => {
    const gesture = TranslateGesture.begin(createContext(
      { kind: "axis", axis: "x", direction: 1 },
      rayAt(0.5, 0)
    ));
    assert.ok(gesture);

    const delta = new THREE.Vector3();
    assert.equal(gesture.update(rayAt(2.7, 0.3), 1, delta), true);
    assertClose(delta.x, 2);
    assertClose(delta.y, 0);
    assertClose(delta.z, 0);

    assert.equal(gesture.update(rayAt(2.7, 0.3), null, delta), true);
    assertClose(delta.x, 2.2);
  });

  test("refuses an axis that points at the camera", () => {
    const gesture = TranslateGesture.begin(createContext(
      { kind: "axis", axis: "z", direction: 1 },
      rayAt(0, 0)
    ));

    assert.equal(gesture, null);
  });

  test("moves along the frame axes of a rotated orientation", () => {
    const gesture = TranslateGesture.begin(createContext(
      { kind: "axis", axis: "x", direction: 1 },
      rayAt(0, 0.5),
      {
        quaternion: new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 0, 1),
          Math.PI / 2
        )
      }
    ));
    assert.ok(gesture);

    const delta = new THREE.Vector3();
    gesture.update(rayAt(0.4, 2.5), null, delta);
    assertClose(delta.x, 0);
    assertClose(delta.y, 2);
  });

  test("moves on a plane with a per-axis snap", () => {
    const gesture = TranslateGesture.begin(createContext(
      { kind: "plane", normal: "z" },
      rayAt(0.5, 0.5)
    ));
    assert.ok(gesture);

    const delta = new THREE.Vector3();
    gesture.update(rayAt(1.7, 3.1), { x: 1, y: 2, z: 1 }, delta);
    assertClose(delta.x, 1);
    assertClose(delta.y, 2);
    assertClose(delta.z, 0);
  });

  test("refuses a plane seen edge-on", () => {
    const gesture = TranslateGesture.begin(createContext(
      { kind: "plane", normal: "x" },
      rayAt(0, 0.5)
    ));

    assert.equal(gesture, null);
  });

  test("moves the center on the view plane", () => {
    const gesture = TranslateGesture.begin(createContext(
      { kind: "center" },
      rayAt(0, 0)
    ));
    assert.ok(gesture);

    const delta = new THREE.Vector3();
    gesture.update(rayAt(-1.5, 2.25), null, delta);
    assert.deepEqual(
      delta.toArray().map((value) => Math.round(value * 100) / 100),
      [-1.5, 2.25, 0]
    );
  });

  test("has no gesture for the view ring", () => {
    assert.equal(
      TranslateGesture.begin(createContext({ kind: "view" }, rayAt(1, 0))),
      null
    );
  });
});
