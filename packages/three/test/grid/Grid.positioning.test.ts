// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { Grid } from "#src/index.ts";

function triggerRender(
  grid: Grid,
  camera: THREE.Camera
): void {
  // @ts-expect-error Only camera is relevant; remaining THREE.WebGLRenderer params are unused
  grid.onBeforeRender(void 0, void 0, camera, void 0, void 0, void 0);
}

describe("infiniteGrid", () => {
  test("defaults to false", () => {
    const grid = new Grid();

    assert.strictEqual(
      grid.infiniteGrid,
      false
    );
  });

  test("reflects the provided infiniteGrid option", () => {
    const grid = new Grid({
      infiniteGrid: true
    });

    assert.ok(grid.infiniteGrid);
  });

  test("uses a fixed 2x2 geometry instead of the extent-sized quad", () => {
    const bounded = new Grid();
    const infinite = new Grid({
      infiniteGrid: true
    });

    const boundedParams = bounded.geometry.parameters;
    const infiniteParams = infinite.geometry.parameters;

    assert.notStrictEqual(boundedParams.width, 2);
    assert.strictEqual(infiniteParams.width, 2);
    assert.strictEqual(infiniteParams.height, 2);
  });

  test("extent option is ignored", () => {
    const grid = new Grid({
      infiniteGrid: true,
      extent: 999
    });

    const params = grid.geometry.parameters;
    assert.strictEqual(params.width, 2);
    assert.strictEqual(params.height, 2);
  });

  test("does not reposition on onBeforeRender (no camera-follow in infinite mode)", () => {
    const grid = new Grid({
      infiniteGrid: true
    });
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(10, 6, -4);

    triggerRender(grid, camera);

    assert.strictEqual(grid.position.x, 0);
    assert.strictEqual(grid.position.y, 0);
    assert.strictEqual(grid.position.z, 0);
  });

  test("offset still round-trips live in infinite mode", () => {
    const grid = new Grid({
      infiniteGrid: true
    });
    grid.offset = 3.5;

    assert.strictEqual(grid.offset, 3.5);
  });
});

describe("camera-following via onBeforeRender", () => {
  test("repositions the grid on its in-plane axes to match the camera", () => {
    const grid = new Grid({
      plane: "xz"
    });
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(10, 6, -4);

    triggerRender(grid, camera);

    assert.strictEqual(grid.position.x, 10);
    assert.strictEqual(grid.position.y, 0);
    assert.strictEqual(grid.position.z, -4);
  });

  test("stays in sync across repeated calls as the camera moves", () => {
    const grid = new Grid({
      plane: "xz"
    });
    const camera = new THREE.PerspectiveCamera();

    camera.position.set(1, 0, 1);
    triggerRender(grid, camera);
    assert.strictEqual(grid.position.x, 1);
    assert.strictEqual(grid.position.z, 1);

    camera.position.set(-9, 0, 3);
    triggerRender(grid, camera);
    assert.strictEqual(grid.position.x, -9);
    assert.strictEqual(grid.position.z, 3);
  });

  test("preserves the constructor offset across calls", () => {
    const grid = new Grid({
      plane: "xz",
      offset: 2.5
    });
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(1, 99, 1);

    triggerRender(grid, camera);

    assert.strictEqual(grid.position.y, 2.5);
  });

  test("followCamera: false keeps the grid pinned to the origin plane regardless of camera position", () => {
    const grid = new Grid({
      plane: "xz",
      followCamera: false,
      offset: 3
    });
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(10, 6, -4);

    triggerRender(grid, camera);

    assert.strictEqual(grid.position.x, 0);
    assert.strictEqual(grid.position.y, 3);
    assert.strictEqual(grid.position.z, 0);
  });

  test("followCamera can be toggled live", () => {
    const grid = new Grid({
      plane: "xz"
    });
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(5, 0, 5);

    triggerRender(grid, camera);
    assert.strictEqual(grid.position.x, 5);
    assert.strictEqual(grid.position.z, 5);

    grid.followCamera = false;
    triggerRender(grid, camera);
    assert.strictEqual(grid.position.x, 0);
    assert.strictEqual(grid.position.z, 0);
  });
});

describe("target fade mode via onBeforeRender", () => {
  test("repositions the grid on its in-plane axes to match fade.target rather than the camera", () => {
    const target = new THREE.Object3D();
    target.position.set(3, 0, -7);

    const grid = new Grid({
      plane: "xz",
      fade: {
        from: "target",
        target
      }
    });
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(10, 6, -4);

    triggerRender(grid, camera);

    assert.strictEqual(grid.position.x, 3);
    assert.strictEqual(grid.position.y, 0);
    assert.strictEqual(grid.position.z, -7);
  });

  test("follows fade.target's world position, not its local position", () => {
    const parent = new THREE.Object3D();
    parent.position.set(100, 0, 0);
    const target = new THREE.Object3D();
    target.position.set(3, 0, -7);
    parent.add(target);
    parent.updateMatrixWorld(true);

    const grid = new Grid({
      plane: "xz",
      fade: {
        from: "target",
        target
      }
    });
    const camera = new THREE.PerspectiveCamera();

    triggerRender(grid, camera);

    assert.strictEqual(grid.position.x, 103);
    assert.strictEqual(grid.position.z, -7);
  });

  test("stays in sync across repeated calls as fade.target moves", () => {
    const target = new THREE.Object3D();
    const grid = new Grid({
      plane: "xz",
      fade: {
        from: "target",
        target
      }
    });
    const camera = new THREE.PerspectiveCamera();

    target.position.set(1, 0, 1);
    triggerRender(grid, camera);
    assert.strictEqual(grid.position.x, 1);
    assert.strictEqual(grid.position.z, 1);

    target.position.set(-9, 0, 3);
    triggerRender(grid, camera);
    assert.strictEqual(grid.position.x, -9);
    assert.strictEqual(grid.position.z, 3);
  });

  test("followCamera: false keeps the grid pinned to the origin plane regardless of fade.target", () => {
    const target = new THREE.Object3D();
    target.position.set(3, 0, -7);

    const grid = new Grid({
      plane: "xz",
      fade: { from: "target", target },
      followCamera: false
    });
    const camera = new THREE.PerspectiveCamera();

    triggerRender(grid, camera);

    assert.strictEqual(grid.position.x, 0);
    assert.strictEqual(grid.position.z, 0);
  });

  test("fade.target can be swapped live and is followed on the next call", () => {
    const firstTarget = new THREE.Object3D();
    firstTarget.position.set(1, 0, 1);
    const secondTarget = new THREE.Object3D();
    secondTarget.position.set(-4, 0, 8);

    const grid = new Grid({
      plane: "xz",
      fade: {
        from: "target",
        target: firstTarget
      }
    });
    const camera = new THREE.PerspectiveCamera();

    triggerRender(grid, camera);
    assert.strictEqual(grid.position.x, 1);
    assert.strictEqual(grid.position.z, 1);

    grid.fade.target = secondTarget;
    triggerRender(grid, camera);
    assert.strictEqual(grid.position.x, -4);
    assert.strictEqual(grid.position.z, 8);
  });

  test("falls back to the camera position once fade.target is cleared", () => {
    const target = new THREE.Object3D();
    target.position.set(1, 0, 1);

    const grid = new Grid({
      plane: "xz",
      fade: {
        from: "target",
        target
      }
    });
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(5, 0, 5);

    grid.fade.target = null;
    triggerRender(grid, camera);

    assert.strictEqual(grid.position.x, 5);
    assert.strictEqual(grid.position.z, 5);
  });

  test("does not reposition on onBeforeRender in infinite mode, but still tracks fade.target's world position", () => {
    const target = new THREE.Object3D();
    target.position.set(3, 0, -7);

    const grid = new Grid({
      infiniteGrid: true,
      fade: {
        from: "target",
        target
      }
    });
    const camera = new THREE.PerspectiveCamera();

    triggerRender(grid, camera);

    assert.strictEqual(grid.position.x, 0);
    assert.strictEqual(grid.position.y, 0);
    assert.strictEqual(grid.position.z, 0);
  });
});
