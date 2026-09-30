// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  AreaBox,
  MarqueeBox
} from "#src/index.ts";
import {
  createHarness,
  pickerCenter
} from "../../fixtures/boxControls.ts";
import { watchDisposal } from "../../fixtures/disposal.ts";

// CONSTANTS
const kEmptyGround = new THREE.Vector3(-10, 0, -10);

function visibleArrowCount(
  box: THREE.Object3D
): number {
  let count = 0;
  box.traverse((child) => {
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

    assert.deepEqual(harness.box.position.toArray(), [3, 0, 0]);
  });

  test("keeps the grab offset when the box is grabbed off its center", () => {
    const harness = createHarness();

    harness.send({ type: "pointerdown", target: harness.at(1, 1, 1) });
    harness.send({ type: "pointermove", target: harness.at(4, 1, 1) });

    assert.deepEqual(harness.box.position.toArray(), [3, 0, 0]);
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

    assert.equal(harness.box.position.y, 0);
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

    assert.deepEqual(harness.box.position.toArray(), [0, 3, 0]);
  });

  test("suspends snapping while Alt is held", () => {
    const harness = createHarness();

    harness.send({ type: "pointerdown", target: harness.at(4, 1, 4) });
    harness.send({
      type: "pointermove",
      target: harness.at(7.4, 1, 4),
      altKey: true
    });

    assert.ok(Math.abs(harness.box.position.x - 3.4) < 1e-6);
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

    assert.equal(harness.box.position.x, 4);
  });
});

describe("resize", () => {
  test("moves the dragged face and pins the opposite one", () => {
    const harness = createHarness();
    const picker = pickerCenter(harness.box, "x", 1);

    harness.send({ type: "pointerdown", target: picker });
    harness.send({ type: "pointermove", target: harness.at(13, 0.5, 4) });

    const { position } = harness.box;
    const size = harness.box.size;
    assert.equal(position.x, 0);
    assert.ok(size.x > 8);
    assert.ok(Number.isInteger(size.x));
    assert.deepEqual([size.y, size.z], [1, 8]);

    const [change] = harness.changes;
    assert.equal(change.mode, "resize");
    assert.equal(change.axis, "x");
  });

  test("dragging the min face keeps the max face still", () => {
    const harness = createHarness();
    const picker = pickerCenter(harness.box, "x", -1);

    harness.send({ type: "pointerdown", target: picker });
    harness.send({ type: "pointermove", target: harness.at(-4, 0.5, 4) });

    const { position } = harness.box;
    assert.ok(position.x < 0);
    assert.equal(position.x + harness.box.size.x, 8);
  });

  test("clamps at the minimum size instead of inverting", () => {
    const harness = createHarness();
    const picker = pickerCenter(harness.box, "x", 1);

    harness.send({ type: "pointerdown", target: picker });
    harness.send({ type: "pointermove", target: harness.at(-10, 0.5, 4) });

    assert.equal(harness.box.size.x, 1);
    assert.equal(harness.box.position.x, 0);
  });

  test("the none policy hides every arrow and never resizes", () => {
    const harness = createHarness();
    const picker = pickerCenter(harness.box, "x", 1);

    harness.controls.resizeAxes = "none";
    harness.render();

    assert.equal(visibleArrowCount(harness.box), 0);
    assert.equal(harness.isOver(picker), false);

    harness.send({ type: "pointerdown", target: picker });
    harness.send({ type: "pointermove", target: harness.at(13, 0.5, 4) });

    assert.deepEqual(harness.box.size.toArray(), [8, 1, 8]);
    assert.ok(harness.changes.every((change) => change.mode !== "resize"));
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

    harness.send({ type: "pointerdown", target: kEmptyGround });

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

    assert.deepEqual(harness.box.position.toArray(), [0, 0, 0]);
  });
});

describe("attach", () => {
  test("marks the attached box as active and restores it on detach", () => {
    const harness = createHarness();
    assert.equal(harness.box.state, "active");

    harness.controls.detach();

    assert.equal(harness.box.state, "idle");
    assert.equal(harness.controls.box, null);
  });

  test("removes the arrows from the previous box", () => {
    const harness = createHarness();
    const other = new AreaBox();
    harness.scene.add(other);

    harness.controls.attach(other);

    assert.equal(visibleArrowCount(harness.box), 0);
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
  test("detaches, disconnects and releases the arrow geometry", () => {
    const harness = createHarness();
    const arrows: THREE.BufferGeometry[] = [];
    harness.box.traverse((child) => {
      if (child instanceof THREE.InstancedMesh) {
        arrows.push(child.geometry);
      }
    });
    const disposals = watchDisposal(...arrows);

    harness.controls.dispose();

    assert.equal(harness.controls.box, null);
    assert.equal(harness.box.state, "idle");
    assert.equal(harness.controls.domElement, null);
    assert.ok(arrows.length > 0);
    assert.deepEqual(disposals, arrows.map(() => 1));

    harness.controls.attach(harness.box);
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

    harness.send({ type: "pointerdown", target: harness.at(4, 1, 4) });
    harness.send({
      type: "pointermove",
      target: harness.at(4, 4, 4),
      shiftKey: true
    });

    assert.deepEqual(harness.box.position.toArray(), [0, 3, 0]);
  });

  test("locks the drag plane once the box has moved", () => {
    const harness = createHarness({ moveAxes: "xyz" });

    harness.send({ type: "pointerdown", target: harness.at(4, 1, 4) });
    harness.send({ type: "pointermove", target: harness.at(7, 1, 4) });
    harness.send({
      type: "pointermove",
      target: harness.at(10, 1, 4),
      shiftKey: true
    });

    assert.equal(harness.box.position.y, 0);
    assert.equal(harness.box.position.x, 6);
  });
});

describe("attach from a pointer event", () => {
  test("claims the press that selected the box, so it drags at once", () => {
    const harness = createHarness();
    const other = new AreaBox({ size: { x: 8, y: 1, z: 8 } });
    other.position.set(30, 0, 0);
    harness.scene.add(other);
    harness.render();

    const press = harness.pointer({
      type: "pointerdown",
      target: harness.at(34, 1, 4)
    });
    const claimed = harness.controls.attach(other, { from: press });

    assert.equal(claimed, true);
    assert.equal(harness.controls.dragging, true);
    assert.equal(harness.starts.length, 1);
  });

  test("claims nothing when the press missed the box", () => {
    const harness = createHarness();
    const other = new AreaBox({ size: { x: 8, y: 1, z: 8 } });
    other.position.set(30, 0, 0);
    harness.scene.add(other);
    harness.render();

    const press = harness.pointer({
      type: "pointerdown",
      target: harness.at(-40, 0, -40)
    });

    assert.equal(harness.controls.attach(other, { from: press }), false);
    assert.equal(harness.controls.dragging, false);
  });

  test("still attaches without an event", () => {
    const harness = createHarness();
    const other = new AreaBox();
    harness.scene.add(other);

    assert.equal(harness.controls.attach(other), false);
    assert.equal(harness.controls.box, other);
  });
});

describe("isOverHandle", () => {
  test("reports a press on a resize arrow", () => {
    const harness = createHarness();

    assert.equal(harness.isOver(pickerCenter(harness.box, "x", 1)), true);
  });

  test("reports false on the body and on empty space", () => {
    const harness = createHarness();

    assert.equal(harness.isOver(harness.at(4, 1, 4)), false);
    assert.equal(harness.isOver(kEmptyGround), false);
  });

  test("updates arrow visibility and picking with the live policy", () => {
    const harness = createHarness({ resizeAxes: "xyz" });
    const topPicker = pickerCenter(harness.box, "y", 1);
    assert.equal(harness.isOver(topPicker), true);

    harness.controls.resizeAxes = "xz";
    harness.render();

    assert.equal(visibleArrowCount(harness.box), 4);
    assert.equal(harness.isOver(topPicker), false);

    harness.controls.resizeAxes = "xyz";
    harness.render();

    assert.equal(visibleArrowCount(harness.box), 6);
    assert.equal(harness.isOver(topPicker), true);
  });
});

describe("handle picking stays live", () => {
  test("still hits an arrow after the camera moved", () => {
    const harness = createHarness();

    assert.equal(harness.isOver(pickerCenter(harness.box, "x", 1)), true);

    harness.aim({ x: 30, y: 60, z: 70 }, { x: 0, y: 0, z: 0 });
    harness.render();

    assert.equal(harness.isOver(pickerCenter(harness.box, "x", 1)), true);
  });

  test("still hits an arrow after the box was resized", () => {
    const harness = createHarness();
    harness.isOver(pickerCenter(harness.box, "x", 1));

    harness.box.size = { x: 24, y: 1, z: 24 };
    harness.render();

    assert.equal(harness.isOver(pickerCenter(harness.box, "x", 1)), true);
  });
});

describe("any box volume", () => {
  function createMarqueeHarness() {
    return createHarness(
      {},
      () => new MarqueeBox({ size: { x: 8, y: 1, z: 8 } })
    );
  }

  test("drags a box that has no fill mesh by its volume", () => {
    const harness = createMarqueeHarness();

    harness.send({ type: "pointerdown", target: harness.at(4, 1, 4) });
    harness.send({ type: "pointermove", target: harness.at(7, 1, 4) });
    harness.send({ type: "pointerup", target: harness.at(7, 1, 4) });

    assert.equal(harness.controls.box, harness.box);
    assert.deepEqual(harness.box.position.toArray(), [3, 0, 0]);
  });

  test("claims nothing from a camera sitting inside the box", () => {
    const harness = createMarqueeHarness();

    harness.aim({ x: 4, y: 0.5, z: 4 }, { x: 8, y: 0.5, z: 8 });
    harness.send({ type: "pointerdown", target: harness.at(6, 0.5, 6) });

    assert.equal(harness.controls.dragging, false);
  });
});

describe("pointer identity", () => {
  test("ignores the motion of a second pointer during a drag", () => {
    const harness = createHarness();

    harness.send({ type: "pointerdown", target: harness.at(4, 1, 4) });
    harness.send({
      type: "pointermove",
      target: harness.at(7, 1, 4),
      pointerId: 2
    });

    assert.equal(harness.changes.length, 0);
    assert.deepEqual(harness.box.position.toArray(), [0, 0, 0]);
  });
});
