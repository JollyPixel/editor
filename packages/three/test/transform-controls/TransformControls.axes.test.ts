// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import { pointerAt } from "../fixtures/pointer.ts";
import { createHarness } from "./harness.ts";

describe("appearance", () => {
  test("hides every handle that involves a disabled axis", () => {
    const harness = createHarness();
    harness.controls.axes = { y: false };

    assert.deepEqual(harness.controls.axes, {
      x: true,
      y: false,
      z: true
    });
    assert.deepEqual(harness.visibleHandles(), [
      "translate-x-positive",
      "translate-z-positive",
      "translate-plane-xz"
    ]);
    assert.equal(
      harness.controls.isOverHandle(pointerAt({
        camera: harness.camera,
        element: harness.element,
        target: harness.pointOnHandle("y-positive"),
        type: "pointerdown"
      })),
      false
    );

    harness.controls.dispose();
  });
});
