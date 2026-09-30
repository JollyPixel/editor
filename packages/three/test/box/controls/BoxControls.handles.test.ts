// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  createHarness,
  pickerCenter,
  type Harness
} from "../../fixtures/boxControls.ts";

// CONSTANTS
const kCornerHeightPivot = new THREE.Vector3(4, 1, 4);
const kEmptyGround = new THREE.Vector3(-10, 0, -10);

function objectNamed(
  root: THREE.Object3D,
  name: string
): THREE.Object3D {
  const object = root.getObjectByName(name);
  assert.ok(object, `expected ${name}`);

  return object;
}

function handlePoint(
  harness: Harness,
  name: string
): THREE.Vector3 {
  harness.render();
  const object = objectNamed(harness.box, name);
  if (!(object instanceof THREE.Mesh)) {
    return object.getWorldPosition(new THREE.Vector3());
  }

  object.geometry.computeBoundingBox();
  const bounds = object.geometry.boundingBox;
  assert.ok(bounds);

  return bounds
    .getCenter(new THREE.Vector3())
    .applyMatrix4(object.matrixWorld);
}

function turnedAround(
  point: THREE.Vector3,
  pivot: THREE.Vector3,
  degrees: number
): THREE.Vector3 {
  return point
    .clone()
    .sub(pivot)
    .applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      THREE.MathUtils.degToRad(degrees)
    )
    .add(pivot);
}

describe("rotate handle", () => {
  test("stays hidden and unpickable without a rotate policy", () => {
    const harness = createHarness();
    const arc = handlePoint(harness, "box-handle-rotate-positive-picker");

    harness.click(arc);

    assert.equal(objectNamed(harness.box, "box-handle-rotate").visible, false);
    assert.equal(harness.isOver(arc), false);
    assert.deepEqual(harness.rotations, []);
  });

  test("a click on each half requests a quarter turn in its direction", () => {
    const harness = createHarness({ rotateAxes: "y" });

    harness.click(handlePoint(harness, "box-handle-rotate-positive-picker"));
    harness.click(handlePoint(harness, "box-handle-rotate-negative-picker"));

    assert.deepEqual(harness.rotations, [
      { axis: "y", turns: 1 },
      { axis: "y", turns: -1 }
    ]);
    assert.deepEqual(harness.box.position.toArray(), [0, 0, 0]);
    assert.deepEqual(harness.box.size.toArray(), [8, 1, 8]);
  });

  test("dragging around the pivot requests one turn per quarter past a dead band", () => {
    const harness = createHarness({ rotateAxes: "y" });
    const start = handlePoint(harness, "box-handle-rotate-positive-picker");

    harness.send({ type: "pointerdown", target: start });
    assert.equal(objectNamed(harness.box, "box-handle-rotate").visible, false);
    assert.equal(objectNamed(harness.box, "box-rotate-dial").visible, true);

    for (const degrees of [48, 42, 48, 60, 100, 150, 30]) {
      harness.send({
        type: "pointermove",
        target: turnedAround(start, kCornerHeightPivot, degrees)
      });
    }
    harness.send({
      type: "pointerup",
      target: turnedAround(start, kCornerHeightPivot, 30)
    });

    assert.deepEqual(
      harness.rotations.map(({ turns }) => turns),
      [1, 1, -1, -1]
    );
    assert.equal(harness.ends.at(-1)?.mode, "rotate");
    assert.equal(objectNamed(harness.box, "box-handle-rotate").visible, true);
  });

  test("follows screen motion when the camera looks across the axis", () => {
    const harness = createHarness({ rotateAxes: "y" });
    harness.aim({ x: 4, y: 1.6, z: 30 }, { x: 4, y: 1, z: 4 });
    const start = handlePoint(harness, "box-handle-rotate-positive-picker");

    harness.send({ type: "pointerdown", target: start });
    harness.send({
      type: "pointermove",
      target: start.clone().add(new THREE.Vector3(10, 0, 0))
    });

    assert.deepEqual(harness.rotations, [{ axis: "y", turns: 1 }]);
  });

  test("marks the configured pivot while the arc is hovered", () => {
    const harness = createHarness({
      rotateAxes: "y",
      pivot: new THREE.Vector3(1, 0, 2)
    });

    harness.send({
      type: "pointermove",
      target: handlePoint(harness, "box-handle-rotate-positive-picker")
    });
    const marker = handlePoint(harness, "box-rotate-pivot");

    assert.equal(objectNamed(harness.box, "box-rotate-dial").visible, true);
    assert.ok(Math.abs(marker.x - 1) < 1e-6);
    assert.ok(Math.abs(marker.z - 2) < 1e-6);
  });

  test("a detach during the press requests no turn", () => {
    const harness = createHarness({ rotateAxes: "y" });

    harness.send({
      type: "pointerdown",
      target: handlePoint(harness, "box-handle-rotate-positive-picker")
    });
    harness.controls.detach();

    assert.deepEqual(harness.rotations, []);
    assert.equal(harness.ends.length, 1);
  });
});

describe("flip chips", () => {
  for (const axis of ["x", "z"] as const) {
    test(`a click on the ${axis} chip requests a mirror along ${axis}`, () => {
      const harness = createHarness({ flipAxes: "xz" });

      harness.click(handlePoint(harness, `box-handle-flip-${axis}`));

      assert.deepEqual(harness.flips, [{ axis }]);
      assert.deepEqual(harness.box.size.toArray(), [8, 1, 8]);
      assert.equal(harness.ends.at(-1)?.mode, "flip");
    });
  }

  test("releasing away from the chip cancels the mirror", () => {
    const harness = createHarness({ flipAxes: "xz" });

    harness.send({
      type: "pointerdown",
      target: handlePoint(harness, "box-handle-flip-x")
    });
    harness.send({ type: "pointermove", target: kEmptyGround });
    harness.send({ type: "pointerup", target: kEmptyGround });

    assert.deepEqual(harness.flips, []);
    assert.equal(harness.ends.length, 1);
  });

  test("hovering a chip shows the mirror plane through the pivot", () => {
    const harness = createHarness({
      flipAxes: "xz",
      pivot: new THREE.Vector3(2, 0, 3)
    });

    harness.send({
      type: "pointermove",
      target: handlePoint(harness, "box-handle-flip-x")
    });
    const plane = handlePoint(harness, "box-mirror-plane");

    assert.equal(objectNamed(harness.box, "box-mirror-plane").visible, true);
    assert.ok(Math.abs(plane.x - 2) < 1e-6);
  });

  test("shows and picks only the chips of the policy", () => {
    const harness = createHarness({ flipAxes: "xyz" });
    const top = handlePoint(harness, "box-handle-flip-y");
    const side = handlePoint(harness, "box-handle-flip-x");
    assert.equal(harness.isOver(top), true);

    harness.controls.flipAxes = "xz";

    assert.equal(objectNamed(harness.box, "box-handle-flip-y").visible, false);
    assert.equal(harness.isOver(top), false);
    assert.equal(harness.isOver(side), true);

    harness.controls.flipAxes = "none";

    assert.equal(harness.isOver(side), false);
  });

  test("keeps the chip and the resize arrow of one axis apart", () => {
    const harness = createHarness({ flipAxes: "xz" });

    harness.click(handlePoint(harness, "box-handle-flip-x"));
    harness.send({
      type: "pointerdown",
      target: pickerCenter(harness.box, "x", 1)
    });
    harness.send({ type: "pointermove", target: harness.at(13, 0.5, 4) });

    assert.deepEqual(harness.flips, [{ axis: "x" }]);
    assert.ok(harness.box.size.x > 8);
  });
});
