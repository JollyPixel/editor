// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { createHarness, pivotArray } from "../../helpers/camera/orbitFlyHarness.ts";

describe("OrbitFlyCamera worldScale", () => {
  test("flies worldScale times the unscaled moveSpeed", () => {
    const harness = createHarness({
      moveSpeed: 18,
      accelerationTime: 0
    });

    harness.camera.worldScale = 0.01;
    harness.hold("KeyW");
    harness.advance();
    const speed = harness.offset.length() * 60;

    assert.equal(harness.camera.moveSpeed, 18);
    assert.ok(Math.abs(speed - 0.18) < 1e-9, `flying at ${speed}`);
  });

  test("lets a lock pivot zoom in down to the scaled minPivotDistance", () => {
    const harness = createHarness({
      focusMode: "lock",
      minPivotDistance: 1,
      position: { x: 0, y: 0, z: 0 }
    });
    const pivot = new THREE.Vector3(0, 0, -0.1);

    harness.camera.worldScale = 0.01;
    harness.camera.enterOrbitFocus(pivot);
    harness.scroll(1000);
    harness.advance();
    harness.scroll(0);
    harness.advance(300);

    assert.ok(
      Math.abs(harness.position.distanceTo(pivot) - 0.01) < 1e-6,
      `distance ${harness.position.distanceTo(pivot)} instead of 0.01`
    );
  });

  test("draws the pivot marker pivotMarkerSize times worldScale long", () => {
    const harness = createHarness({
      focusMode: "lock",
      pivotMarkerSize: 0.5,
      position: { x: 0, y: 0, z: 0 }
    });

    harness.camera.worldScale = 0.01;
    harness.camera.enterOrbitFocus({ x: 0, y: 0, z: -1 });
    const extent = new THREE.Box3()
      .setFromObject(harness.sceneChildren[0])
      .getSize(new THREE.Vector3());

    assert.ok(Math.abs(extent.x - 0.01) < 1e-9, `extent ${extent.x} instead of 0.01`);
  });

  test("pulls an engaged lock pivot within the rescaled maxPivotDistance at once", () => {
    const harness = createHarness({
      focusMode: "lock",
      maxPivotDistance: 200,
      position: { x: 0, y: 0, z: 0 }
    });
    const pivot = new THREE.Vector3(0, 0, -10);

    harness.camera.enterOrbitFocus(pivot);
    harness.camera.worldScale = 0.01;

    assert.ok(Math.abs(harness.position.distanceTo(pivot) - 2) < 1e-6);
  });

  test("scales the lock nudge step", () => {
    const harness = createHarness({
      focusMode: "lock",
      position: { x: 0, y: 0, z: 0 }
    });

    harness.camera.worldScale = 0.5;
    harness.camera.enterOrbitFocus({ x: 0, y: 0, z: -10 });
    harness.pressOnce("KeyD");
    harness.advance(60);

    assert.deepEqual(pivotArray(harness.camera.orbitPivot), [0.5, 0, -10]);
  });

  test("glides a nudge by the same fraction of its step at any scale", () => {
    function nudgedFraction(worldScale: number): number {
      const harness = createHarness({
        focusMode: "lock",
        position: { x: 0, y: 0, z: 0 }
      });

      harness.camera.worldScale = worldScale;
      harness.camera.enterOrbitFocus({ x: 0, y: 0, z: -10 * worldScale });
      harness.pressOnce("KeyD");
      harness.advance(8);

      return (harness.camera.orbitPivot as THREE.Vector3Like).x / worldScale;
    }

    const full = nudgedFraction(1);
    const small = nudgedFraction(0.01);

    assert.ok(full < 1, "the nudge did not glide");
    assert.ok(Math.abs(full - small) < 1e-9, `${small} of the step instead of ${full}`);
  });

  test("scales the elastic trail scroll step and its maximum", () => {
    const harness = createHarness({
      focusMode: "elastic",
      scrollSpeed: 2.5,
      maxPivotDistance: 20,
      position: { x: 0, y: 0, z: 0 }
    });
    const pivot = new THREE.Vector3(0, 0, 0);

    harness.camera.worldScale = 0.1;
    harness.scroll(-1);
    harness.advance();
    harness.scroll(0);
    harness.advance(300);
    assert.ok(Math.abs(harness.position.distanceTo(pivot) - 0.25) < 1e-6);

    harness.scroll(-1000);
    harness.advance();
    harness.scroll(0);
    harness.advance(300);
    assert.ok(Math.abs(harness.position.distanceTo(pivot) - 2) < 1e-6);
  });

  test("rejects a scale that is not a finite number greater than 0", () => {
    const harness = createHarness();

    for (const scale of [0, -1, Number.NaN, Infinity]) {
      assert.throws(() => {
        harness.camera.worldScale = scale;
      }, RangeError);
    }
    assert.equal(harness.camera.worldScale, 1);
  });
});
