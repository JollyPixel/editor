// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  CameraGizmo,
  LightGizmo,
  type CameraGizmoLens
} from "#src/index.ts";
import { watchDisposal } from "../fixtures/disposal.ts";

// CONSTANTS
const kLens: CameraGizmoLens = {
  projection: "perspective",
  fov: 60,
  near: 0.1,
  far: 1000,
  orthographicScale: 10
};

function frustum(
  gizmo: CameraGizmo
): THREE.CameraHelper | undefined {
  return gizmo.children.find(
    (child): child is THREE.CameraHelper => child instanceof THREE.CameraHelper
  );
}

describe("CameraGizmo", () => {
  test("draws a frustum cut at the given depth past near, placed by the given matrix", () => {
    const gizmo = new CameraGizmo({ depth: 2 });
    const matrixWorld = new THREE.Matrix4().makeTranslation(1, 2, 3);

    gizmo.update(kLens, matrixWorld);

    const camera = frustum(gizmo)?.camera;
    assert.ok(camera instanceof THREE.PerspectiveCamera);
    assert.strictEqual(camera.far, 2.1);
    assert.deepEqual(gizmo.matrix.elements, matrixWorld.elements);
  });

  test("swaps the frustum when the projection changes and disposes the old one", () => {
    const gizmo = new CameraGizmo();
    gizmo.update(kLens, new THREE.Matrix4());
    const perspective = frustum(gizmo)!;
    const disposals = watchDisposal(perspective.geometry);

    gizmo.update({ ...kLens, projection: "orthographic" }, new THREE.Matrix4());

    assert.ok(frustum(gizmo)?.camera instanceof THREE.OrthographicCamera);
    assert.ok(!gizmo.children.includes(perspective));
    assert.deepEqual(disposals, [1]);
  });
});

describe("LightGizmo", () => {
  test("draws the shape of the light's kind and disposes it once the light changes", () => {
    const gizmo = new LightGizmo();
    gizmo.update(new THREE.DirectionalLight());
    const shape = gizmo.children.find(
      (child): child is THREE.DirectionalLightHelper => child instanceof THREE.DirectionalLightHelper
    );
    assert.ok(shape !== undefined);
    const disposals = watchDisposal(shape.lightPlane.geometry);

    gizmo.update(new THREE.AmbientLight());

    assert.strictEqual(gizmo.children.length, 1);
    assert.deepEqual(disposals, [1]);
  });

  test("places its icon on the light's world position", () => {
    const parent = new THREE.Group();
    parent.position.set(4, 5, 6);
    const light = new THREE.PointLight();
    parent.add(light);
    const gizmo = new LightGizmo();

    gizmo.update(light);

    const [icon] = gizmo.children;
    assert.deepEqual(icon.position.toArray(), [4, 5, 6]);
  });
});
