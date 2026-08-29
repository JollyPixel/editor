// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  castViewRay,
  voxelPositionOf,
  viewFocusPoint
} from "../../src/shared/viewFocus.ts";

function createCamera(
  position: THREE.Vector3Like,
  target: THREE.Vector3Like
): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.set(position.x, position.y, position.z);
  camera.lookAt(target.x, target.y, target.z);
  camera.updateMatrixWorld(true);

  return camera;
}

/**
 * A one-unit cube whose min corner sits on the given cell.
 */
function createBlock(
  position: THREE.Vector3Like
): THREE.Object3D {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  mesh.position.set(
    position.x + 0.5,
    position.y + 0.5,
    position.z + 0.5
  );

  const root = new THREE.Group();
  root.add(mesh);
  root.updateMatrixWorld(true);

  return root;
}

describe("castViewRay", () => {
  test("reports the solid met under the screen center", () => {
    const camera = createCamera(
      { x: 0.5, y: 10, z: 0.5 },
      { x: 0.5, y: 0, z: 0.5 }
    );

    const hit = castViewRay(camera, createBlock({ x: 0, y: 0, z: 0 }));

    assert.ok(hit);
    assert.equal(hit.ground, false);
    assert.equal(hit.point.y, 1);
    assert.ok(Math.abs(hit.distance - 9) < 1e-6);
  });

  test("falls back to the ground plane when no solid is met", () => {
    const camera = createCamera(
      { x: 0.5, y: 10, z: 0.5 },
      { x: 0.5, y: 0, z: 0.5 }
    );

    const hit = castViewRay(camera, new THREE.Group());

    assert.ok(hit);
    assert.equal(hit.ground, true);
    assert.equal(hit.point.y, 0);
    assert.deepEqual(hit.normal.toArray(), [0, 1, 0]);
  });

  test("returns null past the bounds of the ground plane", () => {
    const camera = createCamera(
      { x: 0, y: 10, z: 0 },
      { x: 40, y: 0, z: 0 }
    );

    assert.equal(
      castViewRay(camera, null, { groundPlaneSize: 10 }),
      null
    );
  });

  test("returns null when the ray leaves the world", () => {
    const camera = createCamera(
      { x: 0, y: 10, z: 0 },
      { x: 0, y: 20, z: 0 }
    );

    assert.equal(castViewRay(camera, null), null);
  });
});

describe("voxelPositionOf", () => {
  const hit = {
    point: new THREE.Vector3(3.2, 1, 4.7),
    distance: 9,
    normal: new THREE.Vector3(0, 1, 0),
    ground: false
  };

  test("takes the free cell in front of the surface", () => {
    assert.deepEqual(
      voxelPositionOf(hit, "front").toArray(),
      [3, 1, 4]
    );
  });

  test("takes the cell the surface belongs to on the back side", () => {
    assert.deepEqual(
      voxelPositionOf(hit, "back").toArray(),
      [3, 0, 4]
    );
  });
});

describe("viewFocusPoint", () => {
  test("lands on top of the solid the camera is aimed at", () => {
    const camera = createCamera(
      { x: 3.5, y: 10, z: 4.5 },
      { x: 3.5, y: 0, z: 4.5 }
    );

    const focus = viewFocusPoint(
      camera,
      createBlock({ x: 3, y: 0, z: 4 })
    );

    assert.deepEqual(focus.toArray(), [3, 1, 4]);
  });

  test("lands on the ground cell the camera is aimed at", () => {
    const camera = createCamera(
      { x: 6.5, y: 10, z: 2.5 },
      { x: 6.5, y: 0, z: 2.5 }
    );

    const focus = viewFocusPoint(camera, new THREE.Group());

    assert.deepEqual(focus.toArray(), [6, 0, 2]);
  });

  test("pulls a hit beyond maxDistance back along the ray", () => {
    const camera = createCamera(
      { x: 0.5, y: 200, z: 0.5 },
      { x: 0.5, y: 0, z: 0.5 }
    );

    const focus = viewFocusPoint(camera, null, { maxDistance: 64 });

    assert.deepEqual(focus.toArray(), [0, 136, 0]);
  });

  test("stays ahead of the camera when the ray hits nothing", () => {
    const camera = createCamera(
      { x: 0.5, y: 4, z: 0.5 },
      { x: 0.5, y: 4, z: -10 }
    );

    const focus = viewFocusPoint(camera, null, { fallbackDistance: 12 });

    assert.deepEqual(focus.toArray(), [0, 4, -12]);
  });

  test("never resolves to the origin while the camera is elsewhere", () => {
    const camera = createCamera(
      { x: 64.5, y: 18, z: -32.5 },
      { x: 64.5, y: 0, z: -32.5 }
    );

    const focus = viewFocusPoint(camera, new THREE.Group());

    assert.deepEqual(focus.toArray(), [64, 0, -33]);
  });
});
