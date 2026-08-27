// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  AreaBox,
  AreaBoxControls,
  type AreaBoxControlsOptions,
  type AreaBoxDragEvent
} from "#src/index.ts";
import {
  createPointerTarget,
  pointerAt,
  type PointerAtOptions
} from "../fixtures/pointer.ts";

interface Harness {
  area: AreaBox;
  camera: THREE.PerspectiveCamera;
  controls: AreaBoxControls;
  element: HTMLElement;
  scene: THREE.Scene;
  changes: AreaBoxDragEvent[];
  starts: unknown[];
  ends: AreaBoxDragEvent[];
  /**
   * Refreshes world matrices, as a renderer would between two frames.
   */
  render: () => void;
  send: (options: Omit<PointerAtOptions, "camera" | "element">) => void;
  at: (x: number, y: number, z: number) => THREE.Vector3;
}

function createHarness(
  options: AreaBoxControlsOptions = {}
): Harness {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(6, 12, 14);
  camera.lookAt(0, 0, 0);

  const element = createPointerTarget();
  const area = new AreaBox({ size: { x: 8, y: 1, z: 8 } });
  scene.add(area);

  const controls = new AreaBoxControls(camera, element, options);
  controls.attach(area);
  scene.updateMatrixWorld(true);

  const changes: AreaBoxDragEvent[] = [];
  const starts: unknown[] = [];
  const ends: AreaBoxDragEvent[] = [];
  controls.addEventListener("start", (event) => starts.push(event));
  controls.addEventListener("change", (event) => changes.push(event));
  controls.addEventListener("end", (event) => ends.push(event));

  return {
    area,
    camera,
    controls,
    element,
    scene,
    changes,
    starts,
    ends,
    render: () => scene.updateMatrixWorld(true),
    send: (pointer) => {
      element.dispatchEvent(
        pointerAt({ ...pointer, camera, element })
      );
    },
    at: (x, y, z) => new THREE.Vector3(x, y, z)
  };
}

/**
 * World center of the picker instance sitting on the face with the highest
 * (or lowest) coordinate along the given axis. The pickers are instances of
 * the one InstancedMesh that is never rendered.
 */
function pickerCenter(
  area: AreaBox,
  axis: "x" | "y" | "z",
  sign: 1 | -1
): THREE.Vector3 {
  const centers: THREE.Vector3[] = [];
  area.traverse((child) => {
    if (child instanceof THREE.InstancedMesh && child.visible === false) {
      const matrix = new THREE.Matrix4();
      for (let instance = 0; instance < child.count; instance++) {
        child.getMatrixAt(instance, matrix);
        centers.push(
          new THREE.Vector3()
            .setFromMatrixPosition(matrix)
            .applyMatrix4(child.matrixWorld)
        );
      }
    }
  });

  assert.ok(centers.length > 0, "expected resize pickers in the area");

  return centers.reduce((best, candidate) => {
    const better = sign === 1
      ? candidate[axis] > best[axis]
      : candidate[axis] < best[axis];

    return better ? candidate : best;
  });
}

function visibleArrowCount(
  area: AreaBox
): number {
  let count = 0;
  area.traverse((child) => {
    // The arrows share one InstancedMesh: the policy is expressed as its
    // instance count, ground-axis slots first.
    if (child instanceof THREE.InstancedMesh && child.visible) {
      count = child.count;
    }
  });

  return count;
}

describe("move", () => {
  test("drags the box on the ground plane, snapped to the grid", () => {
    const harness = createHarness();

    harness.send({ type: "pointerdown", target: harness.at(4, 1, 4) });
    harness.send({ type: "pointermove", target: harness.at(7, 1, 4) });

    assert.deepEqual(harness.area.position.toArray(), [3, 0, 0]);
  });

  test("keeps the grab offset, so the box does not jump under the cursor", () => {
    const harness = createHarness();

    // Grab the far corner of the top face rather than its center.
    harness.send({ type: "pointerdown", target: harness.at(8, 1, 8) });
    harness.send({ type: "pointermove", target: harness.at(8, 1, 8) });

    assert.deepEqual(harness.area.position.toArray(), [0, 0, 0]);
    assert.equal(harness.changes.length, 0);
  });

  test("leaves the vertical axis alone by default", () => {
    const harness = createHarness();

    harness.send({
      type: "pointerdown",
      target: harness.at(4, 1, 4),
      shiftKey: true
    });
    harness.send({
      type: "pointermove",
      target: harness.at(4, 4, 4),
      shiftKey: true
    });

    assert.equal(harness.area.position.y, 0);
  });

  test("moves vertically with Shift when the policy allows it", () => {
    const harness = createHarness({ moveAxes: "xyz" });

    harness.send({
      type: "pointerdown",
      target: harness.at(4, 1, 4),
      shiftKey: true
    });
    harness.send({
      type: "pointermove",
      target: harness.at(4, 4, 4),
      shiftKey: true
    });

    assert.deepEqual(harness.area.position.toArray(), [0, 3, 0]);
  });

  test("suspends snapping while Alt is held", () => {
    const harness = createHarness();

    harness.send({ type: "pointerdown", target: harness.at(4, 1, 4) });
    harness.send({
      type: "pointermove",
      target: harness.at(7.4, 1, 4),
      altKey: true
    });

    assert.ok(Math.abs(harness.area.position.x - 3.4) < 1e-6);
  });

  test("stays inside the bounds", () => {
    const harness = createHarness({
      bounds: new THREE.Box3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(12, 4, 12)
      )
    });

    harness.send({ type: "pointerdown", target: harness.at(4, 1, 4) });
    harness.send({ type: "pointermove", target: harness.at(40, 1, 4) });

    assert.equal(harness.area.position.x, 4);
  });
});

describe("resize", () => {
  test("moves the dragged face and pins the opposite one", () => {
    const harness = createHarness();
    const picker = pickerCenter(harness.area, "x", 1);

    harness.send({ type: "pointerdown", target: picker });
    harness.send({ type: "pointermove", target: harness.at(13, 0.5, 4) });

    const { position } = harness.area;
    const size = harness.area.size;
    assert.equal(position.x, 0);
    assert.ok(size.x > 8);
    assert.ok(Number.isInteger(size.x));
    // Untouched axes keep their extent.
    assert.deepEqual([size.y, size.z], [1, 8]);
  });

  test("dragging the min face keeps the max face still", () => {
    const harness = createHarness();
    const picker = pickerCenter(harness.area, "x", -1);

    harness.send({ type: "pointerdown", target: picker });
    harness.send({ type: "pointermove", target: harness.at(-4, 0.5, 4) });

    const { position } = harness.area;
    assert.ok(position.x < 0);
    assert.equal(position.x + harness.area.size.x, 8);
  });

  test("clamps at the minimum size instead of inverting", () => {
    const harness = createHarness();
    const picker = pickerCenter(harness.area, "x", 1);

    harness.send({ type: "pointerdown", target: picker });
    harness.send({ type: "pointermove", target: harness.at(-10, 0.5, 4) });

    assert.equal(harness.area.size.x, 1);
    assert.equal(harness.area.position.x, 0);
  });

  test("reports the resized axis on the change event", () => {
    const harness = createHarness();
    const picker = pickerCenter(harness.area, "x", 1);

    harness.send({ type: "pointerdown", target: picker });
    harness.send({ type: "pointermove", target: harness.at(13, 0.5, 4) });

    const [change] = harness.changes;
    assert.equal(change.mode, "resize");
    assert.equal(change.axis, "x");
  });

  test("hides the arrows of the excluded axis", () => {
    const ground = createHarness();
    const volume = createHarness({ resizeAxes: "xyz" });

    assert.equal(visibleArrowCount(ground.area), 4);
    assert.equal(visibleArrowCount(volume.area), 6);
  });
});

describe("events", () => {
  test("brackets a gesture with start and end", () => {
    const harness = createHarness();

    harness.send({ type: "pointerdown", target: harness.at(4, 1, 4) });
    assert.equal(harness.controls.dragging, true);
    assert.equal(harness.starts.length, 1);

    harness.send({ type: "pointermove", target: harness.at(7, 1, 4) });
    harness.send({ type: "pointerup", target: harness.at(7, 1, 4) });

    assert.equal(harness.controls.dragging, false);
    assert.equal(harness.ends.length, 1);
    assert.deepEqual(harness.ends[0].min.toArray(), [3, 0, 0]);
    assert.equal(harness.ends[0].mode, "move");
  });

  test("emits once per grid step, not once per pointer event", () => {
    const harness = createHarness();

    harness.send({ type: "pointerdown", target: harness.at(4, 1, 4) });
    for (const offset of [7, 7.1, 7.2, 7.3]) {
      harness.send({ type: "pointermove", target: harness.at(offset, 1, 4) });
    }

    assert.equal(harness.changes.length, 1);

    harness.send({ type: "pointermove", target: harness.at(8, 1, 4) });
    assert.equal(harness.changes.length, 2);
  });

  test("carries the position and extent after the change", () => {
    const harness = createHarness();

    harness.send({ type: "pointerdown", target: harness.at(4, 1, 4) });
    harness.send({ type: "pointermove", target: harness.at(7, 1, 4) });

    const [change] = harness.changes;
    assert.equal(change.mode, "move");
    assert.equal(change.axis, null);
    assert.deepEqual(change.min.toArray(), [3, 0, 0]);
    assert.deepEqual(change.size.toArray(), [8, 1, 8]);
  });

  test("ignores a pointer that missed both the body and the arrows", () => {
    const harness = createHarness();

    harness.send({ type: "pointerdown", target: harness.at(60, 0, 60) });

    assert.equal(harness.controls.dragging, false);
    assert.equal(harness.starts.length, 0);
  });

  test("ignores non-primary buttons", () => {
    const harness = createHarness();

    harness.send({
      type: "pointerdown",
      target: harness.at(4, 1, 4),
      button: 2
    });

    assert.equal(harness.controls.dragging, false);
  });

  test("ignores pointers while disabled", () => {
    const harness = createHarness();
    harness.controls.enabled = false;

    harness.send({ type: "pointerdown", target: harness.at(4, 1, 4) });

    assert.equal(harness.controls.dragging, false);
  });

  test("does not move during an active gesture while disabled", () => {
    const harness = createHarness();

    harness.send({ type: "pointerdown", target: harness.at(4, 1, 4) });
    harness.controls.enabled = false;
    harness.send({ type: "pointermove", target: harness.at(7, 1, 4) });

    assert.deepEqual(harness.area.position.toArray(), [0, 0, 0]);
  });
});

describe("attach", () => {
  test("marks the attached area as active and restores it on detach", () => {
    const harness = createHarness();
    assert.equal(harness.area.state, "active");

    harness.controls.detach();

    assert.equal(harness.area.state, "idle");
    assert.equal(harness.controls.area, null);
  });

  test("removes the arrows from the previous area", () => {
    const harness = createHarness();
    const other = new AreaBox();
    harness.scene.add(other);

    harness.controls.attach(other);

    assert.equal(visibleArrowCount(harness.area), 0);
    assert.equal(visibleArrowCount(other), 4);
  });

  test("ends a running gesture when detaching", () => {
    const harness = createHarness();

    harness.send({ type: "pointerdown", target: harness.at(4, 1, 4) });
    harness.controls.detach();

    assert.equal(harness.controls.dragging, false);
    assert.equal(harness.ends.length, 1);
  });
});

describe("dispose", () => {
  test("stops listening to the element", () => {
    const harness = createHarness();

    harness.controls.dispose();
    harness.send({ type: "pointerdown", target: harness.at(4, 1, 4) });

    assert.equal(harness.controls.dragging, false);
    assert.equal(harness.starts.length, 0);
  });
});

describe("disconnect", () => {
  test("ends a gesture and accepts input after reconnecting", () => {
    const harness = createHarness();

    harness.send({ type: "pointerdown", target: harness.at(4, 1, 4) });
    harness.controls.disconnect();

    assert.equal(harness.controls.dragging, false);
    assert.equal(harness.ends.length, 1);

    harness.controls.connect(harness.element);
    harness.send({ type: "pointerdown", target: harness.at(4, 1, 4) });

    assert.equal(harness.controls.dragging, true);
    assert.equal(harness.starts.length, 2);
  });
});

describe("vertical modifier", () => {
  test("honours Shift pressed after the drag started", () => {
    const harness = createHarness({ moveAxes: "xyz" });

    // The gesture starts without the modifier, as it does when a user reaches
    // for Shift a moment after grabbing the box.
    harness.send({ type: "pointerdown", target: harness.at(4, 1, 4) });
    harness.send({
      type: "pointermove",
      target: harness.at(4, 4, 4),
      shiftKey: true
    });

    assert.deepEqual(harness.area.position.toArray(), [0, 3, 0]);
  });

  test("locks the drag plane once the area has moved", () => {
    const harness = createHarness({ moveAxes: "xyz" });

    harness.send({ type: "pointerdown", target: harness.at(4, 1, 4) });
    harness.send({ type: "pointermove", target: harness.at(7, 1, 4) });
    // Too late: the ground drag already owns this gesture.
    harness.send({
      type: "pointermove",
      target: harness.at(10, 1, 4),
      shiftKey: true
    });

    assert.equal(harness.area.position.y, 0);
    assert.equal(harness.area.position.x, 6);
  });
});

describe("attach from a pointer event", () => {
  test("claims the press that selected the area, so it drags at once", () => {
    const harness = createHarness();
    const other = new AreaBox({ size: { x: 8, y: 1, z: 8 } });
    other.position.set(30, 0, 0);
    harness.scene.add(other);
    harness.render();

    // The press lands on an area the controls are not attached to yet: the
    // host picks it and hands the same event over.
    const press = pointerAt({
      camera: harness.camera,
      element: harness.element,
      target: new THREE.Vector3(34, 1, 4),
      type: "pointerdown"
    });
    const claimed = harness.controls.attach(other, { from: press });

    assert.equal(claimed, true);
    assert.equal(harness.controls.dragging, true);
    assert.equal(harness.starts.length, 1);
  });

  test("claims nothing when the press missed the area", () => {
    const harness = createHarness();
    const other = new AreaBox({ size: { x: 8, y: 1, z: 8 } });
    other.position.set(30, 0, 0);
    harness.scene.add(other);
    harness.render();

    const press = pointerAt({
      camera: harness.camera,
      element: harness.element,
      target: new THREE.Vector3(-40, 0, -40),
      type: "pointerdown"
    });

    assert.equal(harness.controls.attach(other, { from: press }), false);
    assert.equal(harness.controls.dragging, false);
  });

  test("still attaches without an event", () => {
    const harness = createHarness();
    const other = new AreaBox();
    harness.scene.add(other);

    assert.equal(harness.controls.attach(other), false);
    assert.equal(harness.controls.area, other);
  });
});

describe("isOverHandle", () => {
  test("reports a press on a resize arrow", () => {
    const harness = createHarness();
    const picker = pickerCenter(harness.area, "x", 1);

    const press = pointerAt({
      camera: harness.camera,
      element: harness.element,
      target: picker,
      type: "pointerdown"
    });

    assert.equal(harness.controls.isOverHandle(press), true);
  });

  test("reports false on the body and on empty space", () => {
    const harness = createHarness();
    const onBody = pointerAt({
      camera: harness.camera,
      element: harness.element,
      target: harness.at(4, 1, 4),
      type: "pointerdown"
    });
    const onNothing = pointerAt({
      camera: harness.camera,
      element: harness.element,
      target: harness.at(60, 0, 60),
      type: "pointerdown"
    });

    assert.equal(harness.controls.isOverHandle(onBody), false);
    assert.equal(harness.controls.isOverHandle(onNothing), false);
  });

  test("updates arrow visibility and picking with the live policy", () => {
    const harness = createHarness({ resizeAxes: "xyz" });
    const topPicker = pickerCenter(harness.area, "y", 1);
    const press = pointerAt({
      camera: harness.camera,
      element: harness.element,
      target: topPicker,
      type: "pointerdown"
    });
    assert.equal(harness.controls.isOverHandle(press), true);

    harness.controls.resizeAxes = "xz";
    harness.render();

    assert.equal(visibleArrowCount(harness.area), 4);
    assert.equal(harness.controls.isOverHandle(press), false);

    harness.controls.resizeAxes = "xyz";
    harness.render();

    assert.equal(visibleArrowCount(harness.area), 6);
    assert.equal(harness.controls.isOverHandle(press), true);
  });
});

describe("handle picking stays live", () => {
  test("still hits an arrow after the camera moved", () => {
    const harness = createHarness();

    // First raycast, at the original camera distance.
    assert.equal(
      harness.controls.isOverHandle(pointerAt({
        camera: harness.camera,
        element: harness.element,
        target: pickerCenter(harness.area, "x", 1),
        type: "pointerdown"
      })),
      true
    );

    // Pulling the camera back rescales the arrows, which InstancedMesh's
    // cached bounding sphere would not know about.
    harness.camera.position.set(30, 60, 70);
    harness.camera.lookAt(0, 0, 0);
    harness.render();

    assert.equal(
      harness.controls.isOverHandle(pointerAt({
        camera: harness.camera,
        element: harness.element,
        target: pickerCenter(harness.area, "x", 1),
        type: "pointerdown"
      })),
      true
    );
  });

  test("still hits an arrow after the area was resized", () => {
    const harness = createHarness();
    harness.controls.isOverHandle(pointerAt({
      camera: harness.camera,
      element: harness.element,
      target: pickerCenter(harness.area, "x", 1),
      type: "pointerdown"
    }));

    harness.area.size = { x: 24, y: 1, z: 24 };
    harness.render();

    assert.equal(
      harness.controls.isOverHandle(pointerAt({
        camera: harness.camera,
        element: harness.element,
        target: pickerCenter(harness.area, "x", 1),
        type: "pointerdown"
      })),
      true
    );
  });
});
