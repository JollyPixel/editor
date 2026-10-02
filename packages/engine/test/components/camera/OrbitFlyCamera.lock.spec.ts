// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { createHarness, pivotArray } from "../../helpers/orbitFlyHarness.ts";

describe("OrbitFlyCamera orbit focus (lock)", () => {
  test("enterOrbitFocus immediately faces the given point", () => {
    const harness = createHarness({ focusMode: "lock", position: { x: 0, y: 0, z: 0 } });
    const pivot = new THREE.Vector3(5, 0, 0);

    assert.equal(harness.camera.isOrbiting, false);

    harness.camera.enterOrbitFocus(pivot);
    assert.equal(harness.camera.isOrbiting, true);

    const toPivot = pivot.clone().sub(harness.position).normalize();
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(harness.orientation);
    assert.ok(toPivot.angleTo(forward) < 1e-3, "the camera did not face the pivot on entry");
  });

  test("exitOrbitFocus does not move or reorient the camera", () => {
    const harness = createHarness({ focusMode: "lock", position: { x: 0, y: 0, z: 0 } });

    harness.camera.enterOrbitFocus({ x: 5, y: 0, z: 0 });
    const settledPosition = harness.position.clone();
    const settledOrientation = harness.orientation.clone();

    harness.camera.exitOrbitFocus();
    assert.equal(harness.camera.isOrbiting, false);
    assert.deepEqual(harness.position.toArray(), settledPosition.toArray());
    assert.ok(harness.orientation.angleTo(settledOrientation) < 1e-6);
  });

  test("scroll adjusts moveSpeed before any pivot has ever been engaged", () => {
    const harness = createHarness({ focusMode: "lock" });
    const startPosition = harness.position.clone();

    harness.scroll(1);
    harness.advance();

    assert.deepEqual(harness.position.toArray(), startPosition.toArray());
    assert.ok(harness.camera.moveSpeed > 18, "moveSpeed did not increase");
  });

  test("scroll stops adjusting moveSpeed once a pivot has been engaged", () => {
    const harness = createHarness({ focusMode: "lock", position: { x: 0, y: 0, z: 0 } });

    harness.camera.enterOrbitFocus({ x: 0, y: 0, z: -10 });
    const speedBefore = harness.camera.moveSpeed;

    harness.scroll(1);
    harness.advance();

    assert.equal(harness.camera.moveSpeed, speedBefore, "moveSpeed changed while orbiting");
  });

  test("middle-drag orbits around the pivot at a constant distance", () => {
    const harness = createHarness({ focusMode: "lock", position: { x: 0, y: 0, z: 0 } });
    const pivot = new THREE.Vector3(0, 0, -10);

    harness.camera.enterOrbitFocus(pivot);
    const distance = harness.position.distanceTo(pivot);

    harness.lookDrag(80, 0);
    harness.advance(5);
    harness.stopLookDrag();

    assert.ok(
      Math.abs(harness.position.distanceTo(pivot) - distance) < 1e-3,
      "distance to the pivot drifted while orbiting"
    );

    const toPivot = pivot.clone().sub(harness.position).normalize();
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(harness.orientation);
    assert.ok(toPivot.angleTo(forward) < 1e-3, "the camera did not face the pivot");
  });

  test("scroll adjusts pivot distance and clamps instead of releasing", () => {
    const harness = createHarness({
      focusMode: "lock",
      minPivotDistance: 2,
      maxPivotDistance: 20,
      position: { x: 0, y: 0, z: 0 }
    });
    const pivot = new THREE.Vector3(0, 0, -10);

    harness.camera.enterOrbitFocus(pivot);

    harness.scroll(1000);
    harness.advance();
    harness.scroll(0);

    assert.equal(harness.camera.isOrbiting, true, "scrolling in released the lock");
    assert.ok(
      harness.position.distanceTo(pivot) >= 2 - 1e-6,
      "distance dropped below the minimum"
    );

    harness.scroll(-1000);
    harness.advance();
    harness.scroll(0);

    assert.equal(harness.camera.isOrbiting, true);
    assert.ok(
      harness.position.distanceTo(pivot) <= 20 + 1e-6,
      "distance exceeded the maximum"
    );
  });

  test("only exitOrbitFocus releases the lock", () => {
    const harness = createHarness({
      focusMode: "lock",
      minPivotDistance: 2,
      position: { x: 0, y: 0, z: 0 }
    });
    const pivot = new THREE.Vector3(0, 0, -10);

    harness.camera.enterOrbitFocus(pivot);
    harness.scroll(1000);
    harness.advance(20);
    harness.scroll(0);

    assert.equal(harness.camera.isOrbiting, true);

    harness.camera.exitOrbitFocus();
    assert.equal(harness.camera.isOrbiting, false);
  });
});

describe("OrbitFlyCamera orbit focus rig movement", () => {
  test("WASD does not move the camera while orbiting", () => {
    const harness = createHarness({ focusMode: "lock", position: { x: 0, y: 0, z: 0 } });
    const pivot = new THREE.Vector3(0, 0, -10);

    harness.camera.enterOrbitFocus(pivot);

    harness.hold("KeyD");
    harness.advance(20);
    harness.hold();

    assert.equal(harness.offset.lengthSq(), 0, "the camera moved while locked onto the pivot");
  });

  test("movement resumes once the pivot is released", () => {
    const harness = createHarness({ focusMode: "lock", position: { x: 0, y: 0, z: 0 } });

    harness.camera.enterOrbitFocus({ x: 0, y: 0, z: -10 });
    harness.hold("KeyD");
    harness.advance(20);
    harness.hold();
    assert.equal(harness.offset.lengthSq(), 0);

    harness.camera.exitOrbitFocus();
    harness.hold("KeyD");
    harness.advance(20);
    harness.hold();

    assert.ok(harness.offset.lengthSq() > 0, "the camera did not resume moving after release");
  });
});

describe("OrbitFlyCamera orbit focus reselection", () => {
  test("enterOrbitFocus is a no-op while already orbiting", () => {
    const harness = createHarness({ focusMode: "lock", position: { x: 0, y: 0, z: 0 } });
    const firstPivot = { x: 0, y: 0, z: -10 };

    harness.camera.enterOrbitFocus(firstPivot);
    harness.camera.enterOrbitFocus({ x: 20, y: 0, z: 0 });

    assert.deepEqual(pivotArray(harness.camera.orbitPivot), pivotArray(firstPivot));
  });

  test("accepts a new point again once exitOrbitFocus is called", () => {
    const harness = createHarness({ focusMode: "lock", position: { x: 0, y: 0, z: 0 } });

    harness.camera.enterOrbitFocus({ x: 0, y: 0, z: -10 });
    harness.camera.exitOrbitFocus();
    harness.camera.enterOrbitFocus({ x: 20, y: 0, z: 0 });

    assert.deepEqual(pivotArray(harness.camera.orbitPivot), [20, 0, 0]);
  });
});

describe("OrbitFlyCamera orbit focus nudge", () => {
  test("a single key press steps the pivot and camera by one unit, keeping distance", () => {
    const harness = createHarness({ focusMode: "lock", position: { x: 0, y: 0, z: 0 } });
    const pivot = new THREE.Vector3(0, 0, -10);

    harness.camera.enterOrbitFocus(pivot);
    const distanceBefore = harness.position.distanceTo(pivot);

    harness.pressOnce("KeyD");
    harness.advance(60);

    const nudgedPivot = harness.camera.orbitPivot as THREE.Vector3Like;
    assert.deepEqual([nudgedPivot.x, nudgedPivot.y, nudgedPivot.z], [1, 0, -10]);
    assert.ok(
      Math.abs(harness.position.distanceTo(nudgedPivot as THREE.Vector3) - distanceBefore) < 1e-6,
      "distance to the pivot changed on nudge"
    );
  });

  test("only one nudge happens per key press, not per held frame", () => {
    const harness = createHarness({ focusMode: "lock", position: { x: 0, y: 0, z: 0 } });

    harness.camera.enterOrbitFocus({ x: 0, y: 0, z: -10 });

    harness.pressOnce("KeyD");
    harness.advance(60);

    const pivot = harness.camera.orbitPivot as THREE.Vector3Like;
    assert.equal(pivot.x, 1, "the pivot kept stepping while the frame advanced");
  });

  test("forward/backward/up/down nudge along the expected axes", () => {
    const harness = createHarness({ focusMode: "lock", position: { x: 0, y: 0, z: 0 } });

    harness.camera.enterOrbitFocus({ x: 0, y: 0, z: -10 });

    harness.pressOnce("KeyW");
    harness.advance(60);
    assert.deepEqual(pivotArray(harness.camera.orbitPivot), [0, 0, -11]);

    harness.pressOnce("KeyS");
    harness.advance(60);
    harness.pressOnce("KeyS");
    harness.advance(60);
    assert.deepEqual(pivotArray(harness.camera.orbitPivot), [0, 0, -9]);

    harness.pressOnce("Space");
    harness.advance(60);
    assert.deepEqual(pivotArray(harness.camera.orbitPivot), [0, 1, -9]);

    harness.pressOnce("ShiftLeft");
    harness.advance(60);
    assert.deepEqual(pivotArray(harness.camera.orbitPivot), [0, 0, -9]);
  });

  test("does nothing while not orbiting", () => {
    const harness = createHarness({ focusMode: "lock", position: { x: 0, y: 0, z: 0 } });

    harness.pressOnce("KeyD");
    harness.advance();

    assert.equal(harness.camera.orbitPivot, null);
    assert.equal(harness.offset.lengthSq(), 0);
  });
});

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

  test("is never created when showPivotMarker is false", () => {
    const harness = createHarness({ focusMode: "lock", showPivotMarker: false });

    harness.camera.enterOrbitFocus({ x: 0, y: 0, z: -5 });
    assert.equal(harness.camera.isOrbiting, true);
    assert.equal(harness.sceneChildren.length, 0);

    harness.advance();
    harness.camera.exitOrbitFocus();
    harness.camera.destroy();
    assert.equal(harness.sceneChildren.length, 0);
  });
});
