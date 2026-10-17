// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { MarqueeBox } from "#src/index.ts";
import { createHarness, pickerCenter } from "../../fixtures/boxControls.ts";

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
