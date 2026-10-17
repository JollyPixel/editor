// Import Node.js Dependencies
import { describe, test } from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  QUARTER_TURN,
  UP,
  assertClose,
  assertQuaternion,
  assertVector,
  createHarness,
  rotatedAround
} from "./harness.ts";

describe("rotating", () => {
  test("turns the target around a ring by the dragged angle", () => {
    const harness = createHarness({ mode: "rotate" });
    const start = harness.pointOnRing("y-positive");

    harness.drag(
      start,
      rotatedAround(start, new THREE.Vector3(), QUARTER_TURN)
    );

    assertQuaternion(
      harness.target.quaternion,
      new THREE.Quaternion().setFromAxisAngle(UP, QUARTER_TURN)
    );
    assertVector(harness.target.position, [0, 0, 0]);

    harness.send("pointerup", start);
    harness.controls.dispose();
  });

  test("snaps the angle and frees it while Alt is held", () => {
    const harness = createHarness({
      mode: "rotate",
      snap: {
        rotate: Math.PI / 4
      }
    });
    const start = harness.pointOnRing("y-positive");
    const fiftyDegrees = (50 * Math.PI) / 180;
    const end = rotatedAround(start, new THREE.Vector3(), fiftyDegrees);

    harness.drag(start, end);
    assertClose(harness.target.rotation.y, Math.PI / 4);

    harness.send("pointermove", end, { altKey: true });
    assertClose(harness.target.rotation.y, fiftyDegrees);

    harness.send("pointerup", start);
    harness.controls.dispose();
  });

  test("applies a world rotation through a rotated parent", () => {
    const harness = createHarness({ mode: "rotate" });
    const parent = new THREE.Object3D();
    parent.rotation.x = 0.6;
    harness.scene.add(parent);
    parent.add(harness.target);
    harness.scene.updateMatrixWorld(true);
    const before = harness.target.getWorldQuaternion(new THREE.Quaternion());
    const start = harness.pointOnRing("y-positive");

    harness.drag(start, rotatedAround(start, new THREE.Vector3(), 0.5));

    assertQuaternion(
      harness.target.getWorldQuaternion(new THREE.Quaternion()),
      new THREE.Quaternion().setFromAxisAngle(UP, 0.5).multiply(before)
    );

    harness.send("pointerup", start);
    harness.controls.dispose();
  });

  test("orbits the target around the pivot", () => {
    const harness = createHarness({
      mode: "rotate",
      pivot: {
        x: 1,
        y: 0,
        z: 0
      }
    });
    const pivot = new THREE.Vector3(1, 0, 0);
    const start = harness.pointOnRing("y-positive");

    harness.drag(start, rotatedAround(start, pivot, QUARTER_TURN));

    assertVector(harness.target.position, [1, 0, 1]);
    assertVector(
      harness.target.localToWorld(new THREE.Vector3(1, 0, 0)),
      [1, 0, 0],
      "pivot stays put"
    );

    harness.send("pointerup", start);
    harness.controls.dispose();
  });

  test("spins around the view direction from the view ring", () => {
    const harness = createHarness({ mode: "rotate" });
    const start = harness.pointOnRing("view");
    const eye = harness.camera.position.clone().normalize();
    const end = start.clone().applyAxisAngle(eye, 0.75);

    harness.drag(start, end);

    assertQuaternion(
      harness.target.quaternion,
      new THREE.Quaternion().setFromAxisAngle(eye, 0.75)
    );

    harness.send("pointerup", start);
    harness.controls.dispose();
  });
});

describe("scaling", () => {
  test("scales one local axis and leaves the position alone", () => {
    const harness = createHarness({ mode: "scale" });
    harness.target.rotation.y = 0.3;
    harness.scene.updateMatrixWorld(true);
    const start = harness.pointOnHandle("x-positive");

    harness.drag(start, start.clone().multiplyScalar(2));

    assertVector(harness.target.scale, [2, 1, 1]);
    assertVector(harness.target.position, [0, 0, 0]);

    harness.send("pointerup", start);
    harness.controls.dispose();
  });

  test("snaps the resulting scale value, not the factor", () => {
    const harness = createHarness({
      mode: "scale",
      snap: {
        scale: 0.5
      }
    });
    harness.target.scale.y = 2;
    harness.scene.updateMatrixWorld(true);
    const start = harness.pointOnHandle("y-positive");

    harness.drag(start, start.clone().multiplyScalar(1.3));

    assertVector(harness.target.scale, [1, 2.5, 1]);

    harness.send("pointerup", start);
    harness.controls.dispose();
  });

  test("scales away from the pivot", () => {
    const harness = createHarness({
      mode: "scale",
      pivot: {
        x: 1,
        y: 0,
        z: 0
      }
    });
    const pivot = new THREE.Vector3(1, 0, 0);
    const start = harness.pointOnHandle("x-positive");
    const end = start
      .clone()
      .sub(pivot)
      .multiplyScalar(2)
      .add(pivot);

    harness.drag(start, end);

    assertVector(harness.target.scale, [2, 1, 1]);
    assertVector(harness.target.position, [-1, 0, 0]);

    harness.send("pointerup", start);
    harness.controls.dispose();
  });

  test("scales uniformly from an interactive center", () => {
    const harness = createHarness({
      mode: "scale",
      appearance: {
        center: {
          interactive: true
        }
      }
    });
    const diagonal = new THREE.Vector3(1, 1, 0)
      .normalize()
      .applyQuaternion(harness.camera.quaternion)
      .multiplyScalar(harness.gizmoScale());

    harness.drag(new THREE.Vector3(), diagonal);

    assertVector(harness.target.scale, [2, 2, 2]);

    harness.send("pointerup", diagonal);
    harness.controls.dispose();
  });
});
