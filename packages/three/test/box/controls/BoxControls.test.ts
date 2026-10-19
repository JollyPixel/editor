// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { createHarness, pickerCenter } from "../../fixtures/boxControls.ts";

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

describe("cancel", () => {
  test("Escape puts the box back and ends the drag as cancelled", () => {
    const harness = createHarness();
    harness.send({ type: "pointerdown", target: harness.at(4, 1, 4) });
    harness.send({ type: "pointermove", target: harness.at(7, 1, 4) });

    harness.element.ownerDocument.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "Escape" })
    );
    harness.send({ type: "pointermove", target: harness.at(9, 1, 4) });

    assert.deepEqual(harness.box.position.toArray(), [0, 0, 0]);
    assert.deepEqual(harness.changes.at(-1)?.min.toArray(), [0, 0, 0]);
    assert.deepEqual(
      harness.ends.map(({ changed, cancelled }) => {
        return { changed, cancelled };
      }),
      [{ changed: false, cancelled: true }]
    );
  });
});

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
      ctrlKey: true
    });
    harness.send({
      type: "pointermove",
      target: harness.at(4, 4, 4),
      ctrlKey: true
    });

    assert.equal(harness.box.position.y, 0);
  });

  test("moves vertically with Ctrl when the policy allows it", () => {
    const harness = createHarness({ moveAxes: "xyz" });

    harness.send({
      type: "pointerdown",
      target: harness.at(4, 1, 4),
      ctrlKey: true
    });
    harness.send({
      type: "pointermove",
      target: harness.at(4, 4, 4),
      ctrlKey: true
    });

    assert.deepEqual(harness.box.position.toArray(), [0, 3, 0]);
  });

  test("moves vertically with Cmd for macOS users", () => {
    const harness = createHarness({ moveAxes: "xyz" });

    harness.send({
      type: "pointerdown",
      target: harness.at(4, 1, 4),
      metaKey: true
    });
    harness.send({
      type: "pointermove",
      target: harness.at(4, 4, 4),
      metaKey: true
    });

    assert.deepEqual(harness.box.position.toArray(), [0, 3, 0]);
  });

  test("keeps Shift-drags on the ground plane", () => {
    const harness = createHarness({ moveAxes: "xyz" });

    harness.send({
      type: "pointerdown",
      target: harness.at(4, 1, 4),
      shiftKey: true
    });
    harness.send({
      type: "pointermove",
      target: harness.at(7, 4, 4),
      shiftKey: true
    });

    assert.equal(harness.box.position.y, 0);
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

  test("keeps snapping under Alt when snapBypass is off", () => {
    const harness = createHarness({ snapBypass: false });

    harness.send({ type: "pointerdown", target: harness.at(4, 1, 4) });
    harness.send({
      type: "pointermove",
      target: harness.at(7.4, 1, 4),
      altKey: true
    });

    assert.equal(harness.box.position.x, 3);
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
