// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { createHarness, unusedPostProcessing } from "../../helpers/orbitFlyHarness.ts";
import type {
  PostProcessing
} from "../../../src/systems/rendering/PostProcessing.ts";

describe("OrbitFlyCamera vertical movement", () => {
  test("descends while shift is held", () => {
    const harness = createHarness();

    harness.hold("ShiftLeft");
    harness.advance(10);

    assert.ok(harness.offset.y < 0, "the camera did not descend");
  });

  test("stands still while disabled", () => {
    const harness = createHarness();

    harness.camera.enabled = false;
    harness.hold("ShiftLeft");
    harness.advance(10);

    assert.equal(harness.offset.y, 0);
  });

  test("does not resume the descent on a shift held through a gizmo drag", () => {
    const harness = createHarness();

    harness.camera.enabled = false;
    harness.hold("ShiftLeft");
    harness.advance(10);

    harness.camera.enabled = true;
    harness.advance(10);

    assert.equal(harness.offset.y, 0);
  });

  test("descends again once shift is released and pressed anew", () => {
    const harness = createHarness();

    harness.camera.enabled = false;
    harness.hold("ShiftLeft");
    harness.advance();

    harness.camera.enabled = true;
    harness.advance();
    harness.hold();
    harness.advance();
    harness.hold("ShiftLeft");
    harness.advance(10);

    assert.ok(harness.offset.y < 0, "the camera stayed latched");
  });
});

describe("OrbitFlyCamera teleport", () => {
  test("adopts the pose position and orientation", () => {
    const harness = createHarness();
    const quaternion = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(-0.3, 1.2, 0, "YXZ")
    );

    harness.camera.teleport({
      position: { x: 4, y: 5, z: 6 },
      quaternion
    });

    assert.deepEqual(harness.position.toArray(), [4, 5, 6]);
    assert.ok(
      harness.orientation.angleTo(quaternion) < 1e-6,
      "the camera kept a different orientation"
    );
  });

  test("keeps yaw and pitch so a later frame does not snap back", () => {
    const harness = createHarness();
    const quaternion = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(-0.3, 1.2, 0, "YXZ")
    );

    harness.camera.teleport({
      position: { x: 0, y: 0, z: 0 },
      quaternion
    });
    harness.advance(5);

    assert.ok(
      harness.orientation.angleTo(quaternion) < 1e-6,
      "the camera reverted to its former orientation"
    );
  });

  test("clamps a pitch steeper than the camera allows", () => {
    const harness = createHarness();

    harness.camera.teleport({
      position: { x: 0, y: 0, z: 0 },
      quaternion: new THREE.Quaternion().setFromEuler(
        new THREE.Euler(-1.57, 0, 0, "YXZ")
      )
    });

    const pitch = new THREE.Euler()
      .setFromQuaternion(harness.orientation, "YXZ").x;
    assert.ok(
      Math.abs(pitch) <= Math.PI / 2 - 0.01 + 1e-6,
      `the pitch stayed at ${pitch}`
    );
  });

  test("drops the momentum carried into the teleport", () => {
    const harness = createHarness();

    harness.hold("KeyW");
    harness.advance(10);
    harness.hold();
    harness.camera.teleport({
      position: { x: 0, y: 0, z: 0 },
      quaternion: new THREE.Quaternion()
    });
    const settled = harness.offset.clone();
    harness.advance(10);

    assert.deepEqual(harness.offset.toArray(), settled.toArray());
  });
});

describe("OrbitFlyCamera Alt+LeftClick look", () => {
  test("rotates in free-fly, like middle-drag", () => {
    const harness = createHarness();
    const startOrientation = harness.orientation.clone();

    harness.hold("AltLeft");
    harness.lookDrag(80, 0, "left");
    harness.advance(5);
    harness.stopLookDrag();
    harness.hold();

    assert.ok(
      harness.orientation.angleTo(startOrientation) > 1e-3,
      "the camera did not rotate"
    );
  });

  test("plain LeftClick-drag (no Alt) does not rotate the camera", () => {
    const harness = createHarness();
    const startOrientation = harness.orientation.clone();

    harness.lookDrag(80, 0, "left");
    harness.advance(5);
    harness.stopLookDrag();

    assert.deepEqual(
      harness.orientation.toArray(),
      startOrientation.toArray()
    );
  });

  test("orbits around the pivot while locked, like middle-drag", () => {
    const harness = createHarness({ focusMode: "lock", position: { x: 0, y: 0, z: 0 } });
    const pivot = new THREE.Vector3(0, 0, -10);

    harness.camera.enterOrbitFocus(pivot);
    const distance = harness.position.distanceTo(pivot);

    harness.hold("AltLeft");
    harness.lookDrag(80, 0, "left");
    harness.advance(5);
    harness.stopLookDrag();
    harness.hold();

    assert.ok(
      Math.abs(harness.position.distanceTo(pivot) - distance) < 1e-3,
      "distance to the pivot drifted while orbiting"
    );
  });
});

describe("OrbitFlyCamera focus mode \"none\"", () => {
  test("scroll adjusts moveSpeed instead of dollying", () => {
    const harness = createHarness({ focusMode: "none" });
    const startPosition = harness.position.clone();

    harness.scroll(1);
    harness.advance();

    assert.deepEqual(harness.position.toArray(), startPosition.toArray());
    assert.ok(harness.camera.moveSpeed > 18, "moveSpeed did not increase");
  });

  test("ignores enterOrbitFocus entirely", () => {
    const harness = createHarness({ focusMode: "none" });

    harness.camera.enterOrbitFocus({ x: 0, y: 0, z: -10 });

    assert.equal(harness.camera.isOrbiting, false);
    assert.equal(harness.camera.orbitPivot, null);
  });
});

describe("OrbitFlyCamera options", () => {
  test("elastic focus creates no marker when showPivotMarker is false", () => {
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

  test("fov defaults to 60 and is configurable", () => {
    assert.equal(createHarness().camera.fov, 60);
    assert.equal(createHarness({ fov: 45 }).camera.fov, 45);
  });

  test("far defaults to 2000 and camera options are forwarded", () => {
    assert.equal(createHarness().camera.far, 2000);

    const postProcessing: PostProcessing = unusedPostProcessing;
    const viewport = { x: 0, y: 0, width: 0.5, height: 1 };
    const { camera } = createHarness({
      near: 0.5, far: 500, depth: 2, viewport, postProcessing
    });

    assert.deepEqual(
      [camera.near, camera.far, camera.depth, camera.viewport],
      [0.5, 500, 2, viewport]
    );
    assert.equal(camera.postProcessing, postProcessing);
  });
});
