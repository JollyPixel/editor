// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import { RotateGesture } from "#src/transform-controls/gestures/RotateGesture.ts";
import {
  assertClose,
  createContext,
  rayAt
} from "./context.ts";

describe("RotateGesture", () => {
  test("measures the true angle around a ring facing the camera", () => {
    const gesture = RotateGesture.begin(createContext(
      { kind: "axis", axis: "z", direction: 1 },
      rayAt(1, 0)
    ));
    assert.ok(gesture);

    assert.deepEqual(gesture.axis.toArray(), [0, 0, 1]);
    assertClose(gesture.update(rayAt(0, 1), null)!, Math.PI / 2);
    assertClose(gesture.update(rayAt(0, -3), null)!, -Math.PI / 2);
  });

  test("snaps the angle", () => {
    const gesture = RotateGesture.begin(createContext(
      { kind: "axis", axis: "z", direction: 1 },
      rayAt(1, 0)
    ));
    assert.ok(gesture);

    const fiftyDegrees = (50 * Math.PI) / 180;
    assertClose(
      gesture.update(
        rayAt(Math.cos(fiftyDegrees), Math.sin(fiftyDegrees)),
        Math.PI / 4
      )!,
      Math.PI / 4
    );
  });

  test("falls back to a screen tangent when the ring is edge-on", () => {
    const gesture = RotateGesture.begin(createContext(
      { kind: "axis", axis: "y", direction: 1 },
      rayAt(0, 0),
      { size: 2 }
    ));
    assert.ok(gesture);

    assertClose(gesture.update(rayAt(1, 0.7), null)!, 0.5);
    assertClose(gesture.update(rayAt(-3, 0), null)!, -1.5);
  });

  test("rotates around the eye with the view ring", () => {
    const gesture = RotateGesture.begin(createContext(
      { kind: "view" },
      rayAt(1.25, 0)
    ));
    assert.ok(gesture);

    assert.deepEqual(gesture.axis.toArray(), [0, 0, 1]);
    assertClose(gesture.update(rayAt(0, -1.25), null)!, -Math.PI / 2);
  });

  test("refuses a press on the rotation center", () => {
    assert.equal(
      RotateGesture.begin(createContext(
        { kind: "axis", axis: "z", direction: 1 },
        rayAt(0, 0)
      )),
      null
    );
  });

  test("has no gesture for plane and center handles", () => {
    assert.equal(
      RotateGesture.begin(createContext({ kind: "center" }, rayAt(1, 0))),
      null
    );
    assert.equal(
      RotateGesture.begin(createContext(
        { kind: "plane", normal: "z" },
        rayAt(1, 0)
      )),
      null
    );
  });
});
