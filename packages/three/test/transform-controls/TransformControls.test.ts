// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type {
  TransformEndEvent,
  TransformMode
} from "#src/index.ts";
import { pointerAt } from "../fixtures/pointer.ts";
import {
  assertVector,
  createHarness,
  pressEscape
} from "./harness.ts";

describe("appearance", () => {
  test("shows positive arrows and plane handles by default", () => {
    const harness = createHarness();

    assert.deepEqual(harness.visibleHandles(), [
      "translate-x-positive",
      "translate-y-positive",
      "translate-z-positive",
      "translate-plane-yz",
      "translate-plane-xz",
      "translate-plane-xy"
    ]);
    for (const key of ["x-positive", "y-positive", "z-positive"]) {
      const handle = harness.handle(key);
      assert.ok(handle.getObjectByName("transform-handle-outline"));
      assert.ok(handle.getObjectByName("transform-handle-picker"));
    }

    harness.controls.dispose();
  });

  test("swaps the visible handle set with the mode", () => {
    const harness = createHarness();

    harness.controls.mode = "rotate";
    assert.deepEqual(harness.visibleHandles(), [
      "rotate-x-positive",
      "rotate-y-positive",
      "rotate-z-positive",
      "rotate-view"
    ]);

    harness.controls.mode = "scale";
    assert.deepEqual(harness.visibleHandles(), [
      "scale-x-positive",
      "scale-y-positive",
      "scale-z-positive",
      "scale-plane-yz",
      "scale-plane-xz",
      "scale-plane-xy"
    ]);

    harness.controls.dispose();
  });

  test("joins the axis handles at the origin by default", () => {
    const harness = createHarness();

    for (const key of ["x-positive", "y-positive", "z-positive"]) {
      assertVector(harness.handle(key).position, [0, 0, 0], key);
    }

    harness.controls.dispose();
  });

  test("draws the axis pointing at the camera above the others", () => {
    const harness = createHarness();
    harness.camera.position.set(1, 1, 10);
    harness.camera.lookAt(0, 0, 0);
    harness.scene.updateMatrixWorld(true);

    function order(
      key: string
    ): number {
      return harness
        .handle(key)
        .getObjectByName("transform-handle-visual")!
        .renderOrder;
    }

    assert.ok(order("z-positive") > order("x-positive"));
    assert.ok(order("z-positive") > order("y-positive"));

    harness.camera.position.set(1, 1, -10);
    harness.camera.lookAt(0, 0, 0);
    harness.scene.updateMatrixWorld(true);
    assert.ok(order("z-positive") < order("x-positive"));

    harness.controls.dispose();
  });

  test("draws the center above every axis handle", () => {
    const harness = createHarness({
      appearance: {
        center: {}
      }
    });
    harness.camera.position.set(0, 0, 10);
    harness.camera.lookAt(0, 0, 0);
    harness.scene.updateMatrixWorld(true);

    const center = harness.handle("center");
    const axis = harness.handle("z-positive");
    const centerOrder = center
      .getObjectByName("transform-handle-outline")!
      .renderOrder;
    const axisOrder = axis
      .getObjectByName("transform-handle-visual")!
      .renderOrder;
    assert.ok(centerOrder > axisOrder);

    harness.controls.dispose();
  });

  test("supports mirrored directions and excluded axes", () => {
    const harness = createHarness({
      appearance: {
        directions: "both",
        axes: {
          y: false
        }
      }
    });

    assert.deepEqual(harness.visibleHandles(), [
      "translate-x-positive",
      "translate-x-negative",
      "translate-z-positive",
      "translate-z-negative",
      "translate-plane-xz"
    ]);

    harness.controls.dispose();
  });

  test("omits planes, the view ring and outlines on request", () => {
    const harness = createHarness({
      mode: "rotate",
      appearance: {
        handle: {
          kind: "sphere"
        },
        planes: false,
        viewRing: false,
        outline: false
      }
    });

    assert.deepEqual(harness.visibleHandles(), [
      "rotate-x-positive",
      "rotate-y-positive",
      "rotate-z-positive"
    ]);
    harness.controls.mode = "translate";
    assert.deepEqual(harness.visibleHandles(), [
      "translate-x-positive",
      "translate-y-positive",
      "translate-z-positive"
    ]);
    assert.equal(
      harness.controls.helper.getObjectByName("transform-handle-outline"),
      undefined
    );

    harness.controls.dispose();
  });

  test("keeps the center visual-only unless it is interactive", () => {
    const passive = createHarness({
      appearance: {
        center: {
          color: "#f4f1e8"
        }
      }
    });
    const center = passive.handle("center");
    const visual = center.getObjectByName(
      "transform-handle-visual"
    ) as THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;

    assert.equal(visual.material.color.getHexString(), "f4f1e8");
    assert.ok(center.getObjectByName("transform-handle-outline"));
    assert.equal(center.getObjectByName("transform-handle-picker"), undefined);
    assert.equal(
      passive.controls.isOverHandle(pointerAt({
        camera: passive.camera,
        element: passive.element,
        target: new THREE.Vector3(),
        type: "pointerdown"
      })),
      false
    );
    passive.controls.dispose();

    const interactive = createHarness({
      appearance: {
        center: {
          interactive: true
        }
      }
    });
    interactive.send("pointermove", new THREE.Vector3());
    assert.deepEqual(interactive.controls.hoveredHandle, { kind: "center" });
    interactive.controls.dispose();
  });

  test("omits the center by default", () => {
    const harness = createHarness();

    assert.equal(
      harness.controls.helper.getObjectByName("transform-handle-center"),
      undefined
    );

    harness.controls.dispose();
  });

  test("hides view-aligned handles only on request", () => {
    const always = createHarness();
    always.camera.position.set(10, 0, 0);
    always.camera.lookAt(0, 0, 0);
    assert.ok(always.visibleHandles().includes("translate-x-positive"));
    always.controls.dispose();

    const hiding = createHarness({
      appearance: {
        hideAligned: true
      }
    });
    hiding.camera.position.set(10, 0, 0);
    hiding.camera.lookAt(0, 0, 0);
    assert.deepEqual(hiding.visibleHandles(), [
      "translate-y-positive",
      "translate-z-positive",
      "translate-plane-yz"
    ]);
    hiding.controls.dispose();
  });

  test("flips single-direction handles toward the camera on request", () => {
    const harness = createHarness({
      appearance: {
        flipTowardCamera: true
      }
    });
    harness.camera.position.set(-5, 4, 7);
    harness.camera.lookAt(0, 0, 0);
    harness.scene.updateMatrixWorld(true);

    function pointing(
      key: string
    ): THREE.Vector3 {
      return new THREE.Vector3(0, 1, 0)
        .applyQuaternion(harness.handle(key).quaternion);
    }

    assert.ok(pointing("x-positive").x < 0);
    assert.ok(pointing("z-positive").z > 0);
    assert.ok(harness.pointOnHandle("plane-xy").x < 0);
    assert.ok(harness.pointOnHandle("plane-xy").y > 0);

    harness.controls.dispose();
  });

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

  test("disconnects input and disposes owned geometry once", () => {
    const harness = createHarness();
    const visual = harness.handle("x-positive").getObjectByName(
      "transform-handle-visual"
    ) as THREE.Mesh<THREE.BufferGeometry>;
    let disposals = 0;
    visual.geometry.addEventListener("dispose", () => disposals++);

    harness.controls.dispose();
    harness.controls.dispose();
    harness.send("pointerdown", new THREE.Vector3());

    assert.equal(disposals, 1);
    assert.equal(harness.controls.dragging, false);
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

describe("rendering", () => {
  test("visible meshes join the transparent pass", () => {
    const harness = createHarness({
      appearance: {
        center: { outline: { opacity: 1 } },
        outline: { opacity: 1 }
      }
    });

    const names = new Set<string>();
    const opaque: string[] = [];
    harness.controls.helper.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) {
        return;
      }
      const material = object.material as THREE.Material;
      if (!material.visible) {
        return;
      }
      names.add(object.name);
      if (!material.transparent) {
        opaque.push(`${object.parent?.name}/${object.name}`);
      }
    });

    assert.deepEqual([...names].sort(), [
      "transform-handle-border",
      "transform-handle-outline",
      "transform-handle-visual",
      "transform-silhouette"
    ]);
    assert.deepEqual(opaque, []);

    harness.controls.dispose();
  });
});
