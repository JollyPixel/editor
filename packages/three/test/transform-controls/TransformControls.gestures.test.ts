// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { TransformEndEvent } from "#src/index.ts";
import {
  QUARTER_TURN,
  UP,
  assertVector,
  createHarness,
  rotatedAround
} from "./harness.ts";

describe("translating", () => {
  test("moves both ways from one positive handle with relative snapping", () => {
    const harness = createHarness({ snap: { translate: 1 } });
    harness.target.position.x = 0.25;
    harness.scene.updateMatrixWorld(true);
    const start = harness.pointOnHandle("x-positive");

    harness.drag(start, start.clone().add(new THREE.Vector3(-1.6, 0, 0)));

    assert.equal(harness.controls.dragging, true);
    assertVector(harness.target.position, [-1.75, 0, 0]);

    harness.send("pointerup", start);
    assert.equal(harness.controls.dragging, false);
    harness.controls.dispose();
  });

  test("brackets effective changes with copied event payloads", () => {
    const harness = createHarness({ snap: { translate: 1 } });
    const starts: THREE.Vector3[] = [];
    const changes: THREE.Vector3[] = [];
    const ends: TransformEndEvent[] = [];
    harness.controls.addEventListener("start", (event) => {
      starts.push(event.position);
    });
    harness.controls.addEventListener("change", (event) => {
      changes.push(event.position);
    });
    harness.controls.addEventListener("end", (event) => {
      ends.push(event);
    });
    const start = harness.pointOnHandle("x-positive");

    harness.drag(start, start.clone().add(new THREE.Vector3(1.6, 0, 0)));
    harness.send(
      "pointermove",
      start.clone().add(new THREE.Vector3(1.7, 0, 0))
    );
    harness.send("pointerup", start);

    assert.equal(starts.length, 1);
    assert.equal(changes.length, 1);
    assert.equal(ends.length, 1);
    assert.equal(ends[0].changed, true);
    assert.equal(ends[0].cancelled, false);
    assert.equal(ends[0].mode, "translate");
    assert.deepEqual(ends[0].handle, {
      kind: "axis",
      axis: "x",
      direction: 1
    });
    starts[0].set(100, 100, 100);
    assertVector(harness.target.position, [2, 0, 0]);

    harness.controls.dispose();
  });

  test("uses the rotated target axes in local orientation", () => {
    const harness = createHarness({ orientation: "local" });
    harness.target.rotation.z = QUARTER_TURN;
    harness.scene.updateMatrixWorld(true);
    const start = harness.pointOnHandle("x-positive");

    harness.drag(start, start.clone().add(new THREE.Vector3(0, 2, 0)));

    assertVector(harness.target.position, [0, 2, 0]);

    harness.send("pointerup", start);
    harness.controls.dispose();
  });

  test("uses the parent axes and a custom quaternion", () => {
    const harness = createHarness({
      orientation: "parent",
      appearance: {
        planes: false
      }
    });
    const parent = new THREE.Object3D();
    parent.rotation.y = QUARTER_TURN;
    harness.scene.add(parent);
    parent.add(harness.target);
    harness.target.rotation.x = 0.7;
    harness.scene.updateMatrixWorld(true);

    let start = harness.pointOnHandle("x-positive");
    harness.drag(start, start.clone().add(new THREE.Vector3(0, 0, -2)));
    assertVector(harness.target.position, [2, 0, 0], "parent orientation");
    harness.send("pointerup", start);

    harness.controls.orientation = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      QUARTER_TURN
    );
    start = harness.pointOnHandle("x-positive");
    harness.drag(start, start.clone().add(new THREE.Vector3(0, 3, 0)));
    assertVector(harness.target.position, [2, 3, 0], "custom orientation");
    harness.send("pointerup", start);

    harness.controls.dispose();
  });

  test("converts world movement through a transformed parent", () => {
    const harness = createHarness();
    const parent = new THREE.Object3D();
    parent.position.set(3, 2, -4);
    parent.rotation.y = 0.4;
    parent.scale.set(2, 3, 4);
    harness.scene.add(parent);
    parent.add(harness.target);
    harness.scene.updateMatrixWorld(true);
    const before = harness.target.getWorldPosition(new THREE.Vector3());
    const start = harness.pointOnHandle("x-positive");

    harness.drag(start, start.clone().add(new THREE.Vector3(2, 0, 0)));
    const after = harness.target.getWorldPosition(new THREE.Vector3());

    assertVector(after.sub(before), [2, 0, 0]);

    harness.send("pointerup", start);
    harness.controls.dispose();
  });

  test("uses a per-axis snap and suspends it while Alt is held", () => {
    const snapped = createHarness({
      snap: {
        translate: {
          x: 2,
          y: 3,
          z: 4
        }
      }
    });
    const snappedStart = snapped.pointOnHandle("x-positive");

    snapped.drag(
      snappedStart,
      snappedStart.clone().add(new THREE.Vector3(1.2, 0, 0))
    );
    assertVector(snapped.target.position, [2, 0, 0]);
    snapped.send("pointerup", snappedStart);
    snapped.controls.dispose();

    const free = createHarness({ snap: { translate: 2 } });
    const freeStart = free.pointOnHandle("x-positive");
    free.drag(
      freeStart,
      freeStart.clone().add(new THREE.Vector3(1.2, 0, 0)),
      { altKey: true }
    );
    assertVector(free.target.position, [1.2, 0, 0]);
    free.send("pointerup", freeStart);
    free.controls.dispose();
  });

  test("moves on two axes from a plane handle", () => {
    const harness = createHarness({ snap: { translate: 1 } });
    const start = harness.pointOnHandle("plane-xz");

    harness.drag(start, start.clone().add(new THREE.Vector3(1.2, 0, 2.6)));

    assertVector(harness.target.position, [1, 0, 3]);

    harness.send("pointerup", start);
    harness.controls.dispose();
  });

  test("keeps the target under the pointer from an interactive center", () => {
    const harness = createHarness({
      appearance: {
        center: {
          interactive: true
        }
      }
    });
    const aim = new THREE.Vector3(1.5, 2, -1);

    harness.drag(new THREE.Vector3(), aim);

    const cameraPosition = harness.camera.position;
    const toTarget = harness.target.position.clone().sub(cameraPosition);
    const toAim = aim.clone().sub(cameraPosition);
    assert.ok(toTarget.normalize().distanceTo(toAim.normalize()) < 1e-6);
    assert.ok(harness.target.position.length() > 1);

    harness.send("pointerup", aim);
    harness.controls.dispose();
  });

  test("clamps the position to the limits", () => {
    const harness = createHarness({
      limits: new THREE.Box3(
        new THREE.Vector3(-1, -1, -1),
        new THREE.Vector3(1, 1, 1)
      )
    });
    const start = harness.pointOnHandle("x-positive");

    harness.drag(start, start.clone().add(new THREE.Vector3(3, 0, 0)));

    assertVector(harness.target.position, [1, 0, 0]);

    harness.send("pointerup", start);
    harness.controls.dispose();
  });

  test("keeps the gizmo on the pivot while the target moves", () => {
    const harness = createHarness({
      pivot: {
        x: 0,
        y: 2,
        z: 0
      }
    });
    harness.scene.updateMatrixWorld(true);
    assertVector(
      new THREE.Vector3().setFromMatrixPosition(
        harness.controls.helper.matrixWorld
      ),
      [0, 2, 0]
    );

    const start = harness.pointOnHandle("x-positive");
    harness.drag(start, start.clone().add(new THREE.Vector3(3, 0, 0)));
    harness.scene.updateMatrixWorld(true);

    assertVector(harness.target.position, [3, 0, 0]);
    assertVector(
      new THREE.Vector3().setFromMatrixPosition(
        harness.controls.helper.matrixWorld
      ),
      [3, 2, 0]
    );

    harness.send("pointerup", start);
    harness.controls.dispose();
  });
});

describe("rotating", () => {
  test("turns the target around a ring by the dragged angle", () => {
    const harness = createHarness({ mode: "rotate" });
    const start = harness.pointOnRing("y-positive");

    harness.drag(
      start,
      rotatedAround(start, new THREE.Vector3(), QUARTER_TURN)
    );

    const expected = new THREE.Quaternion().setFromAxisAngle(
      UP,
      QUARTER_TURN
    );
    assert.ok(Math.abs(harness.target.quaternion.dot(expected)) > 1 - 1e-9);
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
    assert.ok(
      Math.abs(harness.target.rotation.y - (Math.PI / 4)) < 1e-6
    );

    harness.send("pointermove", end, { altKey: true });
    assert.ok(Math.abs(harness.target.rotation.y - fiftyDegrees) < 1e-6);

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

    const expected = new THREE.Quaternion()
      .setFromAxisAngle(UP, 0.5)
      .multiply(before);
    const after = harness.target.getWorldQuaternion(new THREE.Quaternion());
    assert.ok(Math.abs(after.dot(expected)) > 1 - 1e-9);

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

    const expected = new THREE.Quaternion().setFromAxisAngle(eye, 0.75);
    assert.ok(Math.abs(harness.target.quaternion.dot(expected)) > 1 - 1e-9);

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

  test("snaps the resulting scale", () => {
    const harness = createHarness({
      mode: "scale",
      snap: {
        scale: 0.5
      }
    });
    const start = harness.pointOnHandle("y-positive");

    harness.drag(start, start.clone().multiplyScalar(1.3));

    assertVector(harness.target.scale, [1, 1.5, 1]);

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
