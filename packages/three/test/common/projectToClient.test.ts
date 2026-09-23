// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { projectToClient } from "#src/common/projectToClient.ts";

// CONSTANTS
const kCanvas = {
  getBoundingClientRect: () => {
    return {
      left: 100,
      top: 50,
      width: 400,
      height: 200
    };
  }
};

function frontCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(90, 2, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);

  return camera;
}

describe("projectToClient", () => {
  test("maps the point the camera looks at to the canvas centre", () => {
    const client = projectToClient(frontCamera(), kCanvas, { x: 0, y: 0, z: 0 });

    assert.deepEqual(client, { x: 300, y: 150 });
  });

  test("maps the view edges to the canvas bounds, with y pointing down", () => {
    const camera = new THREE.OrthographicCamera(-4, 4, 2, -2, 0.1, 100);
    camera.position.set(0, 0, 10);

    assert.deepEqual(
      projectToClient(camera, kCanvas, { x: -4, y: 2, z: 0 }),
      { x: 100, y: 50 }
    );
    assert.deepEqual(
      projectToClient(camera, kCanvas, { x: 2, y: -1, z: 0 }),
      { x: 400, y: 200 }
    );
  });

  test("uses the camera pose even before the first render", () => {
    const camera = frontCamera();
    camera.position.set(3, 0, 10);
    camera.lookAt(3, 0, 0);

    assert.deepEqual(
      projectToClient(camera, kCanvas, { x: 3, y: 0, z: 0 }),
      { x: 300, y: 150 }
    );
  });

  test("returns null for a point behind the camera", () => {
    assert.equal(
      projectToClient(frontCamera(), kCanvas, { x: 0, y: 0, z: 20 }),
      null
    );
  });
});
