// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { AreaBox } from "#src/index.ts";
import { BoxView } from "#src/box/controls/gizmo/BoxView.ts";
import { BoxRotateHandle } from "#src/box/controls/gizmo/BoxRotateHandle.ts";

function createView(
  cameraPosition: THREE.Vector3Like
) {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.copy(cameraPosition);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();

  const parent = new THREE.Group();
  parent.position.set(100, 0, 0);
  const box = new AreaBox({
    position: { x: -2, y: 0, z: -2 },
    size: { x: 4, y: 2, z: 4 }
  });
  parent.add(box);
  parent.updateMatrixWorld(true);

  const view = new BoxView({
    camera,
    handleSize: 0.05,
    pivot: (target, out) => out.copy(target.position)
  });
  view.update(box);

  return { camera, box, view };
}

describe("BoxView", () => {
  test("points its eye at the camera in the box's own space", () => {
    const { view } = createView({ x: 100, y: 1, z: 30 });

    assert.ok(view.eye.z > 0.99, `eye ${view.eye.toArray()}`);
    assert.ok(Math.abs(view.eye.lengthSq() - 1) < 1e-9);
  });

  test("grows the handle scale with the distance to the camera", () => {
    const { view } = createView({ x: 100, y: 1, z: 30 });

    assert.ok(view.handleScale({ x: 2, y: 0, z: -20 }) > view.handleScale({ x: 2, y: 0, z: 4 }));
  });
});

describe("BoxRotateHandle", () => {
  const cases = [
    { camera: { x: 130, y: 10, z: 30 }, corner: [4, 2, 4] },
    { camera: { x: 70, y: 10, z: 30 }, corner: [0, 2, 4] },
    { camera: { x: 70, y: 10, z: -30 }, corner: [0, 2, 0] },
    { camera: { x: 130, y: 10, z: -30 }, corner: [4, 2, 0] }
  ];

  for (const { camera, corner } of cases) {
    test(`sits on the top corner facing a camera at ${camera.x}, ${camera.z}`, () => {
      const { view } = createView(camera);
      const handle = new BoxRotateHandle();

      handle.face(view);

      assert.deepStrictEqual(handle.position.toArray(), corner);
      assert.strictEqual(handle.scale.x, view.handleScale(handle.position));
    });
  }
});
