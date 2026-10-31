// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { type TransformEndEvent, type TransformMode } from "#src/index.ts";
import { watchDisposal } from "../fixtures/disposal.ts";
import { pointerAt } from "../fixtures/pointer.ts";
import {
  assertVector,
  createHarness,
  pressEscape
} from "./harness.ts";

describe("picking", () => {
  test("hits an axis picker and leaves the center empty", () => {
    const harness = createHarness();

    assert.equal(
      harness.controls.isOverHandle(pointerAt({
        camera: harness.camera,
        element: harness.element,
        target: harness.pointOnHandle("x-positive"),
        type: "pointerdown"
      })),
      true
    );
    assert.equal(
      harness.controls.isOverHandle(pointerAt({
        camera: harness.camera,
        element: harness.element,
        target: new THREE.Vector3(),
        type: "pointerdown"
      })),
      false
    );

    harness.controls.dispose();
  });

  test("ignores the hidden back half of a rotate ring", () => {
    const harness = createHarness({
      mode: "rotate",
      axes: {
        x: false,
        z: false
      },
      appearance: {
        viewRing: false
      }
    });
    const ring = harness.handle("y-positive", "rotate");
    harness.scene.updateMatrixWorld(true);
    const front = ring.localToWorld(new THREE.Vector3(1, 0, 0));
    const back = ring.localToWorld(new THREE.Vector3(-0.6, 0.8, 0));

    harness.send("pointermove", front);
    assert.deepEqual(harness.controls.hoveredHandle, {
      kind: "axis",
      axis: "y",
      direction: 1
    });
    harness.send("pointermove", back);
    assert.equal(harness.controls.hoveredHandle, null);
    harness.controls.dispose();

    const full = createHarness({
      mode: "rotate",
      axes: {
        x: false,
        z: false
      },
      appearance: {
        viewRing: false,
        rings: {
          frontOnly: false
        }
      }
    });
    full.send("pointermove", back);
    assert.deepEqual(full.controls.hoveredHandle, {
      kind: "axis",
      axis: "y",
      direction: 1
    });
    assert.equal(
      full.controls.helper.getObjectByName("transform-silhouette"),
      undefined
    );
    full.controls.dispose();
  });

  test("reports the hovered and active handles", () => {
    const harness = createHarness();
    const start = harness.pointOnHandle("plane-xz");

    harness.send("pointermove", start);
    assert.deepEqual(harness.controls.hoveredHandle, {
      kind: "plane",
      normal: "y"
    });
    assert.equal(harness.controls.activeHandle, null);

    harness.send("pointerdown", start);
    assert.equal(harness.controls.hoveredHandle, null);
    assert.deepEqual(harness.controls.activeHandle, {
      kind: "plane",
      normal: "y"
    });

    harness.controls.dispose();
  });
});

describe("gesture lifecycle", () => {
  test("reports an unchanged click on end", () => {
    const harness = createHarness();
    const ends: TransformEndEvent[] = [];
    harness.controls.addEventListener("end", (event) => ends.push(event));
    const start = harness.pointOnHandle("x-positive");

    harness.send("pointerdown", start);
    harness.send("pointerup", start);

    assert.equal(ends.length, 1);
    assert.equal(ends[0].changed, false);

    harness.controls.dispose();
  });

  test("restores the start transform on Escape", () => {
    const harness = createHarness();
    harness.target.position.set(1, 2, 3);
    harness.scene.updateMatrixWorld(true);
    const ends: TransformEndEvent[] = [];
    let changes = 0;
    harness.controls.addEventListener("end", (event) => ends.push(event));
    harness.controls.addEventListener("change", () => changes++);
    const start = harness.pointOnHandle("x-positive");

    harness.drag(start, start.clone().add(new THREE.Vector3(2, 0, 0)));
    assertVector(harness.target.position, [3, 2, 3]);
    pressEscape();

    assertVector(harness.target.position, [1, 2, 3]);
    assert.equal(harness.controls.dragging, false);
    assert.equal(changes, 2);
    assert.equal(ends.length, 1);
    assert.equal(ends[0].cancelled, true);
    assert.equal(ends[0].changed, false);

    pressEscape();
    assert.equal(ends.length, 1);

    harness.controls.dispose();
  });

  test("ends a gesture when the target is reparented", () => {
    const harness = createHarness();
    let ended = 0;
    harness.controls.addEventListener("end", () => ended++);
    const start = harness.pointOnHandle("x-positive");

    harness.send("pointerdown", start);
    const parent = new THREE.Object3D();
    harness.scene.add(parent);
    parent.add(harness.target);
    harness.send(
      "pointermove",
      start.clone().add(new THREE.Vector3(1, 0, 0))
    );

    assert.equal(harness.controls.dragging, false);
    assert.equal(ended, 1);

    harness.controls.dispose();
  });

  test("ends a gesture when the mode changes", () => {
    const harness = createHarness();
    let ended = 0;
    harness.controls.addEventListener("end", () => ended++);

    harness.send("pointerdown", harness.pointOnHandle("x-positive"));
    harness.controls.mode = "rotate";

    assert.equal(harness.controls.dragging, false);
    assert.equal(ended, 1);

    harness.controls.dispose();
  });

  test("detaches and disposes owned geometry and materials once", () => {
    const harness = createHarness();
    const visual = harness.handle("x-positive").getObjectByName(
      "transform-handle-visual"
    ) as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
    const disposals = watchDisposal(visual.geometry, visual.material);

    harness.controls.dispose();
    harness.controls.dispose();

    assert.deepEqual(disposals, [1, 1]);
    assert.equal(harness.controls.target, null);
  });

  test("disconnect ends a gesture and reconnect accepts another", () => {
    const harness = createHarness();
    let ended = 0;
    harness.controls.addEventListener("end", () => ended++);
    const start = harness.pointOnHandle("x-positive");

    harness.send("pointerdown", start);
    harness.controls.disconnect();

    assert.equal(harness.controls.dragging, false);
    assert.equal(ended, 1);

    harness.controls.connect(harness.element);
    harness.send("pointerdown", start);
    assert.equal(harness.controls.dragging, true);

    harness.controls.dispose();
  });
});

describe("settings", () => {
  test("rejects unknown modes and invalid snap steps", () => {
    const harness = createHarness();

    assert.throws(
      () => {
        harness.controls.mode = "shear" as TransformMode;
      },
      TypeError
    );
    assert.throws(
      () => {
        harness.controls.snap = { rotate: 0 };
      },
      RangeError
    );
    assert.throws(
      () => {
        harness.controls.snap = { translate: { x: 1, y: -1, z: 1 } };
      },
      RangeError
    );
    assert.throws(
      () => {
        harness.controls.snap = { grid: Number.NaN };
      },
      RangeError
    );

    harness.controls.dispose();
  });

  test("returns copies of the snap and pivot settings", () => {
    const harness = createHarness({
      snap: {
        translate: { x: 1, y: 2, z: 3 }
      },
      pivot: { x: 1, y: 1, z: 1 }
    });

    const { translate } = harness.controls.snap;
    assert.ok(translate instanceof THREE.Vector3);
    translate.set(9, 9, 9);
    assert.deepEqual(harness.controls.snap, {
      translate: new THREE.Vector3(1, 2, 3),
      grid: null,
      rotate: null,
      scale: null
    });

    const pivot = harness.controls.pivot;
    assert.ok(pivot instanceof THREE.Vector3);
    pivot.set(9, 9, 9);
    assert.deepEqual(harness.controls.pivot, new THREE.Vector3(1, 1, 1));

    harness.controls.dispose();
  });
});
