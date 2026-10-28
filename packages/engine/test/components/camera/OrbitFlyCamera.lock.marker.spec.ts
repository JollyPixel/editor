// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import { createHarness } from "../../helpers/camera/orbitFlyHarness.ts";

describe("OrbitFlyCamera orbit focus marker", () => {
  test("is created lazily, reused, and its visibility follows isOrbiting", () => {
    const harness = createHarness({ focusMode: "lock" });

    assert.equal(harness.sceneChildren.length, 0);

    harness.camera.enterOrbitFocus({ x: 0, y: 0, z: -5 });
    assert.equal(harness.sceneChildren.length, 1);
    assert.equal(harness.sceneChildren[0].visible, true);

    harness.camera.exitOrbitFocus();
    assert.equal(harness.sceneChildren.length, 1, "the marker was removed instead of hidden");
    assert.equal(harness.sceneChildren[0].visible, false);

    const marker = harness.sceneChildren[0];
    harness.camera.enterOrbitFocus({ x: 0, y: 0, z: -8 });
    assert.equal(harness.sceneChildren.length, 1, "a second marker was created");
    assert.equal(harness.sceneChildren[0], marker);
    assert.equal(harness.sceneChildren[0].visible, true);
  });

  test("is disposed and detached on destroy", () => {
    const harness = createHarness({ focusMode: "lock" });

    harness.camera.enterOrbitFocus({ x: 0, y: 0, z: -5 });
    assert.equal(harness.sceneChildren.length, 1);

    harness.camera.destroy();

    assert.equal(harness.sceneChildren.length, 0);
  });

  test("is never created by a lock focus when showPivotMarker is false", () => {
    const harness = createHarness({ focusMode: "lock", showPivotMarker: false });

    harness.camera.enterOrbitFocus({ x: 0, y: 0, z: -5 });
    assert.equal(harness.camera.isOrbiting, true);
    assert.equal(harness.sceneChildren.length, 0);

    harness.advance();
    harness.camera.exitOrbitFocus();
    harness.camera.destroy();
    assert.equal(harness.sceneChildren.length, 0);
  });

  test("is never created by an elastic focus when showPivotMarker is false", () => {
    const harness = createHarness({
      focusMode: "elastic",
      maxPivotDistance: 20,
      position: { x: 0, y: 0, z: 0 },
      initialTrailDistance: 12,
      showPivotMarker: false
    });

    assert.equal(harness.camera.isOrbiting, true);
    assert.equal(harness.sceneChildren.length, 0);

    harness.scroll(-10);
    harness.advance();
    harness.scroll(0);
    assert.equal(harness.sceneChildren.length, 0);
  });
});
