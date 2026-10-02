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

describe("OrbitFlyCamera orbit focus (elastic)", () => {
  test("starts fully zoomed in, with the camera matching the pivot exactly", () => {
    const harness = createHarness({
      focusMode: "elastic",
      position: { x: 3, y: 4, z: 5 }
    });

    assert.equal(harness.camera.isOrbiting, false);
    assert.deepEqual(pivotArray(harness.camera.orbitPivot), [3, 4, 5]);
    assert.deepEqual(harness.position.toArray(), [3, 4, 5]);
  });

  test("WASD moves the pivot, and the camera follows it at zero trail distance", () => {
    const harness = createHarness({ focusMode: "elastic", position: { x: 0, y: 0, z: 0 } });

    harness.hold("KeyD");
    harness.advance(20);
    harness.hold();

    assert.ok(harness.position.lengthSq() > 0, "the camera did not move");
    const pivot = harness.camera.orbitPivot as THREE.Vector3Like;
    assert.ok(
      harness.position.distanceTo(new THREE.Vector3(pivot.x, pivot.y, pivot.z)) < 1e-9,
      "camera position diverged from the pivot at zero trail distance"
    );
  });

  test("scrolling out increases trail distance and pulls the camera behind the pivot", () => {
    const harness = createHarness({
      focusMode: "elastic",
      maxPivotDistance: 20,
      position: { x: 0, y: 0, z: 0 }
    });

    harness.scroll(-10);
    harness.advance();
    harness.scroll(0);

    assert.equal(harness.camera.isOrbiting, true, "did not start trailing");
    const pivot = harness.camera.orbitPivot as THREE.Vector3Like;
    const distance = harness.position.distanceTo(new THREE.Vector3(pivot.x, pivot.y, pivot.z));
    assert.ok(distance > 0 && distance <= 20 + 1e-6, `unexpected trail distance ${distance}`);
  });

  test("scrolling fully back in returns to a zero trail distance", () => {
    const harness = createHarness({
      focusMode: "elastic",
      maxPivotDistance: 20,
      position: { x: 0, y: 0, z: 0 }
    });

    harness.scroll(-10);
    harness.advance(100);
    harness.scroll(1000);
    harness.advance(100);
    harness.scroll(0);

    assert.equal(harness.camera.isOrbiting, false);
    const pivot = harness.camera.orbitPivot as THREE.Vector3Like;
    assert.ok(
      harness.position.distanceTo(new THREE.Vector3(pivot.x, pivot.y, pivot.z)) < 1e-6
    );
  });

  test("mouse-look orbits the camera around the pivot without moving the pivot", () => {
    const harness = createHarness({
      focusMode: "elastic",
      maxPivotDistance: 20,
      position: { x: 0, y: 0, z: 0 }
    });

    harness.scroll(-10);
    harness.advance(100);
    harness.scroll(0);
    const pivotBefore = harness.camera.orbitPivot as THREE.Vector3Like;
    const positionBefore = harness.position.clone();

    harness.lookDrag(80, 0);
    harness.advance(5);
    harness.stopLookDrag();

    const pivotAfter = harness.camera.orbitPivot as THREE.Vector3Like;
    assert.deepEqual(
      pivotArray(pivotAfter),
      pivotArray(pivotBefore),
      "the pivot moved from mouse-look alone"
    );
    assert.ok(
      harness.position.distanceTo(positionBefore) > 1e-3,
      "the camera did not move while looking around"
    );

    const distanceToPivot = harness.position.distanceTo(
      new THREE.Vector3(pivotAfter.x, pivotAfter.y, pivotAfter.z)
    );
    assert.ok(Math.abs(distanceToPivot - 20) < 1e-3, `distance to pivot drifted: ${distanceToPivot}`);
  });

  test("enterOrbitFocus and exitOrbitFocus are no-ops", () => {
    const harness = createHarness({ focusMode: "elastic", position: { x: 0, y: 0, z: 0 } });

    harness.camera.enterOrbitFocus({ x: 5, y: 0, z: 0 });
    assert.deepEqual(pivotArray(harness.camera.orbitPivot), [0, 0, 0]);

    harness.camera.exitOrbitFocus();
    assert.deepEqual(pivotArray(harness.camera.orbitPivot), [0, 0, 0]);
  });

  test("the marker appears once trailing and hides back at zero", () => {
    const harness = createHarness({
      focusMode: "elastic",
      maxPivotDistance: 20,
      position: { x: 0, y: 0, z: 0 }
    });

    assert.equal(harness.sceneChildren.length, 0);

    harness.scroll(-10);
    harness.advance();
    harness.scroll(0);
    assert.equal(harness.sceneChildren.length, 1);
    assert.equal(harness.sceneChildren[0].visible, true);

    harness.scroll(1000);
    harness.advance();
    harness.scroll(0);
    assert.equal(harness.sceneChildren[0].visible, false);
  });

  test("pivotPosition seeds the pivot independently of the camera's own position", () => {
    const harness = createHarness({
      focusMode: "elastic",
      position: { x: 0, y: 1, z: 5 },
      pivotPosition: { x: 0, y: 2, z: 0 }
    });

    assert.deepEqual(pivotArray(harness.camera.orbitPivot), [0, 2, 0]);
    assert.deepEqual(harness.position.toArray(), [0, 1, 5]);
  });

  test("initialTrailDistance starts the camera already trailing, marker shown", () => {
    const harness = createHarness({
      focusMode: "elastic",
      maxPivotDistance: 20,
      position: { x: 0, y: 0, z: 0 },
      initialTrailDistance: 12
    });

    assert.equal(harness.camera.isOrbiting, true);
    assert.equal(harness.sceneChildren.length, 1);
    assert.equal(harness.sceneChildren[0].visible, true);

    harness.advance();

    const pivot = harness.camera.orbitPivot as THREE.Vector3Like;
    const distance = harness.position.distanceTo(
      new THREE.Vector3(pivot.x, pivot.y, pivot.z)
    );
    assert.ok(Math.abs(distance - 12) < 1e-6, `unexpected trail distance ${distance}`);
  });
});
